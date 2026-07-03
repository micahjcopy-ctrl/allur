import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { editImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { Buffer } from "node:buffer";
import {
  speechToText,
  textToSpeech,
  detectAudioFormat,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import {
  CoachChatBody,
  CoachChatResponse,
  CoachVoiceBody,
  CoachVoiceResponse,
  CoachTranscribeBody,
  CoachTranscribeResponse,
  AnalyzePhysiqueBody,
  AnalyzePhysiqueResponse,
  AnalyzeMealBody,
  AnalyzeMealResponse,
  AnalyzeWeightBody,
  AnalyzeWeightResponse,
  PersonalizePlanBody,
  PersonalizePlanResponse,
  type CoachChatRequest,
  type PersonalizePlanRequest,
} from "@workspace/api-zod";
import {
  matchFood,
  computeMacros,
  groundedMacros,
  sumMacros,
  confidenceLevel,
  type FoodMacros,
  type CookingMethod,
} from "@workspace/nutrition";
import { requireCredit } from "../lib/creditGuard";
import { makeRateLimit } from "../lib/rateLimit";
import { buildCoachSystemPrompt, buildPersonalizePlanPrompt } from "../lib/coachPrompt";
import {
  buildBodyFatSystemPrompt,
  referenceChartsFor,
} from "../lib/bodyFatKnowledge";
import {
  MEN_BODY_FAT_CHART,
  WOMEN_BODY_FAT_CHART,
} from "../lib/bodyFatReferenceImages";

const router: IRouter = Router();

// The text/vision coaching model. On Replit this was the proxy alias "gpt-5.4";
// off-Replit set OPENAI_CHAT_MODEL to any chat-completions model your key can
// access (defaults to a broadly-available model).
const CHAT_MODEL = process.env["OPENAI_CHAT_MODEL"] || "gpt-4o";

// Per-IP rate limiters for the coach endpoints, which call paid LLM/STT/TTS
// APIs. Backed by a shared Postgres counter (see lib/rateLimit.ts) so the caps
// hold across all serverless instances rather than per-instance on Vercel.
// Separate named buckets so a cheap chat turn and an expensive vision call are
// throttled independently.
// Text/voice coaching: chatty, low cost per call.
const rateLimit = makeRateLimit("coach", 20, 60_000);
// Vision analysis: paid per call and far more expensive, so throttle it harder.
const visionRateLimit = makeRateLimit("vision", 6, 60_000);

// Photos are downscaled client-side before upload; cap the decoded image well
// above that (~3 MB) so a legitimate phone photo always fits but a crafted
// oversized payload to the paid vision model is rejected cheaply.
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,/i;

const exerciseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "sets", "reps", "rest"],
  properties: {
    name: { type: "string" },
    sets: { type: "number" },
    reps: { type: "string", description: "e.g. '8-12' or 'AMRAP'" },
    rest: { type: "string", description: "e.g. '90s' or '2m'" },
    note: { type: "string" },
  },
} as const;

const updatePlanTool = {
  type: "function" as const,
  function: {
    name: "update_training_plan",
    description:
      "Apply an agreed change to the user's workout plan. Only call this once the user has clearly agreed to a concrete change. You must return the COMPLETE updated plan (all days, all exercises), preserving everything the user did not ask to change.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["message", "summary", "days"],
      properties: {
        message: {
          type: "string",
          description: "Your normal conversational reply to show in the chat.",
        },
        summary: {
          type: "string",
          description: "Very short (3-6 word) label of what changed.",
        },
        days: {
          type: "array",
          description: "The complete updated plan.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["dayName", "title", "exercises"],
            properties: {
              dayName: { type: "string" },
              title: { type: "string" },
              exercises: { type: "array", items: exerciseSchema },
            },
          },
        },
      },
    },
  },
};

// Structured tool for the one-shot, automatic plan rebalance that runs after a
// fresh physique analysis. Forcing tool_choice to this guarantees a complete
// updated plan plus a human-readable explanation and an itemised change list.
const rebalancePlanTool = {
  type: "function" as const,
  function: {
    name: "rebalance_training_plan",
    description:
      "Apply the physique-analysis-driven rebalance to the user's plan. You must return the COMPLETE updated plan (all days, all exercises), preserving everything you did not intentionally change.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "explanation", "changes", "days"],
      properties: {
        summary: {
          type: "string",
          description: "Very short (3-6 word) label of the rebalance.",
        },
        explanation: {
          type: "string",
          description:
            "Warm, plain-language paragraph telling the user how their scan shaped these changes.",
        },
        changes: {
          type: "array",
          description: "Specific, concrete changes that were applied.",
          items: { type: "string" },
        },
        days: {
          type: "array",
          description: "The complete updated plan.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["dayName", "title", "exercises"],
            properties: {
              dayName: { type: "string" },
              title: { type: "string" },
              exercises: { type: "array", items: exerciseSchema },
            },
          },
        },
      },
    },
  },
};

type CoachResult = {
  reply: string;
  planUpdated: boolean;
  planSummary?: string | null;
  updatedPlan?: unknown;
};

/**
 * The shared coach "brain": runs gpt-5.4 with the plan-editing tool and returns
 * a validated reply (+ optional plan update). Used by both the text and voice
 * routes so agreed plan changes apply identically regardless of input mode.
 */
async function runCoach(
  body: CoachChatRequest,
  log: Request["log"],
): Promise<CoachResult> {
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: buildCoachSystemPrompt(body) },
      ...body.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    tools: [updatePlanTool],
    tool_choice: "auto",
  });

  const choice = completion.choices[0]?.message;
  const toolCall = choice?.tool_calls?.find(
    (c) => c.type === "function" && c.function.name === "update_training_plan",
  );

  if (toolCall && toolCall.type === "function") {
    let rawArgs: { message?: string; summary?: string; days?: unknown } = {};
    try {
      rawArgs = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      log.warn("coach tool_call arguments were not valid JSON; falling back to text");
    }
    const validated = CoachChatResponse.safeParse({
      reply: rawArgs.message ?? "",
      planUpdated: true,
      planSummary: rawArgs.summary ?? null,
      updatedPlan: rawArgs.days,
    });
    const updatedPlan = validated.success ? validated.data.updatedPlan : null;
    // Only honour a plan edit when we actually have a complete, non-empty plan.
    // Otherwise the UI would show "Plan updated" while nothing changed.
    if (
      validated.success &&
      validated.data.reply &&
      Array.isArray(updatedPlan) &&
      updatedPlan.length > 0
    ) {
      return validated.data;
    }
    log.warn(
      { err: validated.success ? "missing reply or plan" : validated.error },
      "coach tool_call output failed validation; falling back to text",
    );
  }

  const reply =
    choice?.content?.trim() ||
    "Sorry, I couldn't put that into words just now. Could you rephrase?";
  return CoachChatResponse.parse({ reply, planUpdated: false });
}

router.post("/coach/chat", rateLimit, async (req: Request, res: Response): Promise<void> => {
  const parsed = CoachChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  const charge = await requireCredit(req, res, "coaching");
  if (!charge) return;

  try {
    const result = await runCoach(parsed.data as CoachChatRequest, req.log);
    res.json(result);
  } catch (err) {
    await charge.refund();
    req.log.error({ err }, "coach chat request failed");
    res.status(500).json({ error: "The coach is unavailable right now." });
  }
});

// Uncharged plan adaptation. Used by onboarding to adapt a freshly generated
// plan around the user's injuries/dietary constraints — a system-initiated step
// that must NOT burn one of the user's coaching credits at signup. Auth-gated
// and rate-limited (same per-IP limiter) so it isn't a free-coaching backdoor.
router.post("/coach/adapt-plan", rateLimit, async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please sign in to use this feature." });
    return;
  }
  const parsed = CoachChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  try {
    const result = await runCoach(parsed.data as CoachChatRequest, req.log);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "coach adapt-plan request failed");
    res.status(500).json({ error: "The coach is unavailable right now." });
  }
});

type PersonalizeResult = {
  planUpdated: boolean;
  planSummary: string | null;
  explanation: string;
  changes: string[];
  updatedPlan: unknown;
};

/**
 * One-shot plan rebalance from a fresh physique analysis. Forces the
 * rebalance_training_plan tool so we always get a complete updated plan plus an
 * explanation and an itemised change list. Falls back to "no change" if the
 * model fails to return a usable plan, so the UI never claims a change that did
 * not happen.
 */
async function runPersonalizePlan(
  body: PersonalizePlanRequest,
  log: Request["log"],
): Promise<PersonalizeResult> {
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    max_completion_tokens: 8192,
    messages: [
      { role: "system", content: buildPersonalizePlanPrompt(body) },
      {
        role: "user",
        content:
          "Rebalance my plan based on my latest physique scan and tell me what you changed.",
      },
    ],
    tools: [rebalancePlanTool],
    tool_choice: {
      type: "function",
      function: { name: "rebalance_training_plan" },
    },
  });

  const noChange: PersonalizeResult = {
    planUpdated: false,
    planSummary: null,
    explanation:
      "Your plan already lines up well with your latest scan, so I didn't change it. Ask the Coach anytime to fine-tune it.",
    changes: [],
    updatedPlan: null,
  };

  const toolCall = completion.choices[0]?.message?.tool_calls?.find(
    (c) => c.type === "function" && c.function.name === "rebalance_training_plan",
  );
  if (!toolCall || toolCall.type !== "function") {
    log.warn("personalize-plan: model did not call the rebalance tool");
    return noChange;
  }

  let rawArgs: {
    summary?: string;
    explanation?: string;
    changes?: unknown;
    days?: unknown;
  } = {};
  try {
    rawArgs = JSON.parse(toolCall.function.arguments || "{}");
  } catch {
    log.warn("personalize-plan: tool arguments were not valid JSON");
    return noChange;
  }

  const validated = PersonalizePlanResponse.safeParse({
    planUpdated: true,
    planSummary: rawArgs.summary ?? null,
    explanation: rawArgs.explanation ?? "",
    changes: Array.isArray(rawArgs.changes) ? rawArgs.changes : [],
    updatedPlan: rawArgs.days,
  });

  const updatedPlan = validated.success ? validated.data.updatedPlan : null;
  if (
    validated.success &&
    validated.data.explanation &&
    validated.data.changes.length > 0 &&
    Array.isArray(updatedPlan) &&
    updatedPlan.length > 0
  ) {
    // Truthfulness guard: if the model echoed the plan back unchanged, don't
    // claim a rebalance happened even though it returned a changes list.
    if (plansAreEqual(body.plan, updatedPlan)) {
      log.warn("personalize-plan: model returned an unchanged plan; reporting no change");
      return noChange;
    }
    return {
      planUpdated: true,
      planSummary: validated.data.planSummary ?? null,
      explanation: validated.data.explanation,
      changes: validated.data.changes,
      updatedPlan,
    };
  }

  log.warn(
    { err: validated.success ? "missing explanation, changes, or plan" : validated.error },
    "personalize-plan: tool output failed validation; reporting no change",
  );
  return noChange;
}

// Normalised structural comparison of two plans, ignoring key order so a plan
// the model echoed back verbatim is recognised as "no change".
function plansAreEqual(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string => {
    const seen = (x: unknown): unknown => {
      if (Array.isArray(x)) return x.map(seen);
      if (x && typeof x === "object") {
        return Object.keys(x as Record<string, unknown>)
          .sort()
          .reduce<Record<string, unknown>>((acc, k) => {
            acc[k] = seen((x as Record<string, unknown>)[k]);
            return acc;
          }, {});
      }
      return x;
    };
    return JSON.stringify(seen(v));
  };
  return norm(a) === norm(b);
}

router.post(
  "/coach/personalize-plan",
  rateLimit,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = PersonalizePlanBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    // A rebalance only makes sense when there is an existing plan to adjust.
    if (!parsed.data.plan.length) {
      res.status(400).json({ error: "No workout plan to personalize yet." });
      return;
    }

    try {
      const result = await runPersonalizePlan(
        parsed.data as PersonalizePlanRequest,
        req.log,
      );
      res.json(PersonalizePlanResponse.parse(result));
    } catch (err) {
      req.log.error({ err }, "personalize-plan request failed");
      res.status(500).json({ error: "Couldn't personalize your plan right now." });
    }
  },
);

router.post("/coach/voice", rateLimit, async (req: Request, res: Response): Promise<void> => {
  const parsed = CoachVoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }
  const body = parsed.data;

  const charge = await requireCredit(req, res, "coaching");
  if (!charge) return;

  try {
    const audioBuffer = Buffer.from(body.audio, "base64");
    if (audioBuffer.length < 64) {
      await charge.refund();
      res.status(400).json({ error: "Could not hear anything. Please try again." });
      return;
    }

    // Trust the actual bytes, not the client-declared format: browsers record in
    // different containers (Chrome webm, Safari mp4). Anything the transcription
    // API can't take directly is converted to wav via ffmpeg.
    const detected = detectAudioFormat(audioBuffer);
    let sttBuffer = audioBuffer;
    let sttFormat: "wav" | "mp3" | "webm" | "mp4" | "ogg";
    if (detected === "wav" || detected === "mp3" || detected === "webm") {
      sttFormat = detected;
    } else {
      const compatible = await ensureCompatibleFormat(audioBuffer);
      sttBuffer = Buffer.from(compatible.buffer);
      sttFormat = compatible.format;
    }
    const userTranscript = (await speechToText(sttBuffer, sttFormat)).trim();

    if (!userTranscript) {
      await charge.refund();
      res.status(400).json({ error: "Could not hear anything. Please try again." });
      return;
    }

    const result = await runCoach(
      {
        messages: [...body.messages, { role: "user", content: userTranscript }],
        goal: body.goal,
        profile: body.profile,
        plan: body.plan,
        physique: body.physique,
      } as CoachChatRequest,
      req.log,
    );

    const speech = await textToSpeech(result.reply, "nova", "mp3");

    res.json(
      CoachVoiceResponse.parse({
        userTranscript,
        reply: result.reply,
        planUpdated: result.planUpdated,
        planSummary: result.planSummary ?? null,
        updatedPlan: result.updatedPlan ?? null,
        audio: speech.toString("base64"),
        audioFormat: "mp3",
      }),
    );
  } catch (err) {
    await charge.refund();
    req.log.error({ err }, "coach voice request failed");
    res.status(500).json({ error: "The coach is unavailable right now." });
  }
});

// Lightweight speech-to-text only: used during onboarding so users can speak
// their injuries / dietary restrictions instead of typing. Unlike /coach/voice
// this skips the coaching round-trip and TTS — it just returns the transcript.
router.post("/coach/transcribe", rateLimit, async (req: Request, res: Response): Promise<void> => {
  const parsed = CoachTranscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }
  const body = parsed.data;

  try {
    const audioBuffer = Buffer.from(body.audio, "base64");
    if (audioBuffer.length < 64) {
      res.status(400).json({ error: "Could not hear anything. Please try again." });
      return;
    }

    // Trust the actual bytes, not the client-declared format (Chrome records
    // webm, Safari mp4). Convert anything the STT API can't take to wav.
    const detected = detectAudioFormat(audioBuffer);
    let sttBuffer = audioBuffer;
    let sttFormat: "wav" | "mp3" | "webm" | "mp4" | "ogg";
    if (detected === "wav" || detected === "mp3" || detected === "webm") {
      sttFormat = detected;
    } else {
      const compatible = await ensureCompatibleFormat(audioBuffer);
      sttBuffer = Buffer.from(compatible.buffer);
      sttFormat = compatible.format;
    }
    const text = (await speechToText(sttBuffer, sttFormat)).trim();

    if (!text) {
      res.status(400).json({ error: "Could not hear anything. Please try again." });
      return;
    }

    res.json(CoachTranscribeResponse.parse({ text }));
  } catch (err) {
    req.log.error({ err }, "coach transcribe request failed");
    res.status(500).json({ error: "Transcription is unavailable right now." });
  }
});

// Structured-output tool for the vision analysis. Forcing tool_choice to this
// function guarantees we get a parseable, range-based estimate (never a single
// exact number) plus the per-muscle breakdown the Progress UI renders.
const bodyFatAnalysisTool = {
  type: "function" as const,
  function: {
    name: "report_body_fat_analysis",
    description:
      "Report your structured visual body-fat and physique analysis. Always give a RANGE, never a single exact number, and never claim clinical accuracy.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "bodyFatLow",
        "bodyFatHigh",
        "confidence",
        "markers",
        "limitations",
        "suggestedDirection",
        "summary",
        "scores",
        "parts",
      ],
      properties: {
        bodyFatLow: { type: "number", description: "Low end of the body-fat range (%)." },
        bodyFatHigh: { type: "number", description: "High end of the body-fat range (%)." },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        markers: {
          type: "array",
          description: "3-5 key visual markers supporting the estimate.",
          items: { type: "string" },
        },
        limitations: {
          type: "string",
          description: "What limits the accuracy of this image-based estimate.",
        },
        suggestedDirection: {
          type: "string",
          description: "Best starting training/nutrition direction given the estimate and goal.",
        },
        summary: {
          type: "string",
          description:
            "Warm, plain-language coaching paragraph: the range, the main markers, the limitation, and the best next step.",
        },
        scores: {
          type: "object",
          additionalProperties: false,
          required: [
            "abdominalDefinition",
            "waistLeanness",
            "muscleDefinition",
            "fatDistribution",
            "imageQuality",
          ],
          properties: {
            abdominalDefinition: { type: "number", description: "1-5" },
            waistLeanness: { type: "number", description: "1-5" },
            muscleDefinition: { type: "number", description: "1-5" },
            fatDistribution: { type: "number", description: "1-5" },
            imageQuality: { type: "number", description: "1-5" },
          },
        },
        parts: {
          type: "array",
          description: "Visible development rating for each of the six muscle groups.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["part", "rating", "note"],
            properties: {
              part: {
                type: "string",
                enum: ["Shoulders", "Chest", "Back", "Arms", "Core", "Legs"],
              },
              rating: { type: "number", description: "0-100 visible development." },
              note: { type: "string", description: "Short, specific observation." },
            },
          },
        },
      },
    },
  },
};

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

router.post(
  "/coach/analyze-physique",
  visionRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AnalyzePhysiqueBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    const { photos, profile } = parsed.data;
    // Validate every uploaded photo (format + size) before paying for a vision
    // call. The client may send multiple angles/views of the same person.
    for (const photo of photos) {
      if (!ALLOWED_PHOTO_RE.test(photo)) {
        res.status(400).json({ error: "A JPEG, PNG, or WebP image is required." });
        return;
      }
      // Estimate the decoded size from the base64 payload (4 chars -> 3 bytes).
      const base64 = photo.slice(photo.indexOf(",") + 1);
      const decodedBytes = Math.floor((base64.length * 3) / 4);
      if (decodedBytes > MAX_PHOTO_BYTES) {
        res.status(413).json({ error: "That image is too large. Please use a smaller photo." });
        return;
      }
    }

    const charge = await requireCredit(req, res, "bodyScan");
    if (!charge) return;

    try {
      const charts = referenceChartsFor(profile.gender);
      const content: VisionContentPart[] = [
        {
          type: "text",
          text: "Reference body-fat chart(s) — use as a visual anchor for the category ranges:",
        },
      ];
      for (const c of charts) {
        content.push({
          type: "image_url",
          image_url: { url: c === "men" ? MEN_BODY_FAT_CHART : WOMEN_BODY_FAT_CHART },
        });
      }
      content.push({
        type: "text",
        text:
          photos.length > 1
            ? `Now analyze THIS user. The following ${photos.length} images are different angles/views of the same person — consider ALL of them together and report a single combined estimate via the report_body_fat_analysis tool:`
            : "Now analyze THIS user's photo and report via the report_body_fat_analysis tool:",
      });
      for (const photo of photos) {
        content.push({ type: "image_url", image_url: { url: photo } });
      }

      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: buildBodyFatSystemPrompt(profile) },
          { role: "user", content },
        ],
        tools: [bodyFatAnalysisTool],
        tool_choice: {
          type: "function",
          function: { name: "report_body_fat_analysis" },
        },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.find(
        (c) => c.type === "function" && c.function.name === "report_body_fat_analysis",
      );
      if (!toolCall || toolCall.type !== "function") {
        await charge.refund();
        req.log.warn("analyze-physique: model did not call the report tool");
        res.status(500).json({
          error: "Couldn't analyze that photo. Try a clearer, well-lit photo showing your torso.",
        });
        return;
      }

      let args: {
        bodyFatLow?: number;
        bodyFatHigh?: number;
        confidence?: string;
        markers?: unknown;
        limitations?: string;
        suggestedDirection?: string;
        summary?: string;
        parts?: Array<{ part?: string; rating?: number; note?: string }>;
      };
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        await charge.refund();
        req.log.warn("analyze-physique: tool arguments were not valid JSON");
        res.status(500).json({ error: "Couldn't read the analysis result. Please try again." });
        return;
      }

      const a = Number(args.bodyFatLow);
      const b = Number(args.bodyFatHigh);
      const low = Math.round(Math.min(a, b) * 10) / 10;
      const high = Math.round(Math.max(a, b) * 10) / 10;
      const midpoint = Math.round(((low + high) / 2) * 10) / 10;

      const validated = AnalyzePhysiqueResponse.safeParse({
        bodyFatLow: low,
        bodyFatHigh: high,
        bodyFatMidpoint: midpoint,
        confidence: args.confidence,
        markers: Array.isArray(args.markers) ? args.markers : [],
        limitations: args.limitations ?? "",
        suggestedDirection: args.suggestedDirection ?? "",
        summary: args.summary ?? "",
        parts: Array.isArray(args.parts)
          ? args.parts.map((p) => ({ part: p.part, rating: p.rating, note: p.note }))
          : [],
      });

      if (!validated.success) {
        await charge.refund();
        req.log.warn({ err: validated.error }, "analyze-physique: tool output failed validation");
        res.status(500).json({ error: "Couldn't read the analysis result. Please try again." });
        return;
      }

      res.json(validated.data);
    } catch (err) {
      await charge.refund();
      req.log.error({ err }, "analyze-physique request failed");
      res.status(500).json({ error: "Physique analysis is unavailable right now." });
    }
  },
);

// Structured-output tool for meal vision analysis. The model's job is to IDENTIFY
// foods and ESTIMATE portions (with separate confidences) — it does NOT decide the
// final macro numbers. The server grounds macros in the internal nutrition DB and
// only falls back to the model's per-item estimate when a food isn't in the DB.
const mealAnalysisTool = {
  type: "function" as const,
  function: {
    name: "report_meal_analysis",
    description:
      "Report the foods you can see in the meal photo, your confidence in each, an estimated portion in grams, likely hidden calorie sources, and any clarification questions needed when confidence is low.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["isFood", "name", "foods", "hiddenCalorieRisks", "clarificationQuestions"],
      properties: {
        isFood: {
          type: "boolean",
          description: "True only if the photo actually shows food or a meal/drink.",
        },
        name: { type: "string", description: "Short name of the meal, e.g. 'Chicken & rice bowl'." },
        foods: {
          type: "array",
          description:
            "Each distinct food item visible. Identify items separately. Do not list tiny garnishes (lettuce, herbs, lemon) that barely affect macros.",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "detectedName",
              "category",
              "alternatives",
              "confidence",
              "grams",
              "portionConfidence",
              "cookingMethod",
              "skinOn",
              "breaded",
              "estCalories",
              "estProtein",
              "estCarbs",
              "estFat",
            ],
            properties: {
              detectedName: {
                type: "string",
                description: "Plain food name, e.g. 'grilled chicken breast', 'white rice'.",
              },
              category: {
                type: "string",
                enum: ["protein", "carb", "fat", "vegetable", "fruit", "dairy", "sauce", "drink", "dessert", "other"],
              },
              alternatives: {
                type: "array",
                description: "Other foods it could plausibly be, best guess first (e.g. ['salmon','pork']).",
                items: { type: "string" },
              },
              confidence: {
                type: "number",
                description: "Identification confidence, 0 to 1.",
              },
              grams: { type: "number", description: "Estimated portion size in grams." },
              portionConfidence: {
                type: "number",
                description: "Confidence in the portion-size estimate, 0 to 1 (separate from identification).",
              },
              cookingMethod: {
                type: "string",
                enum: ["raw", "grilled", "baked", "roasted", "steamed", "boiled", "sauteed", "fried", "deep_fried", "unknown"],
                description: "How this food appears to have been cooked. Use 'unknown' if not visually clear.",
              },
              skinOn: {
                type: "boolean",
                description: "True if poultry/fish skin is left on (adds fat). False when skinless or not applicable.",
              },
              breaded: {
                type: "boolean",
                description: "True if a breaded/battered/fried coating is visible (adds carbs and oil). False otherwise.",
              },
              estCalories: { type: "number", description: "Fallback calorie estimate for this item only." },
              estProtein: { type: "number", description: "Fallback protein grams for this item only." },
              estCarbs: { type: "number", description: "Fallback carb grams for this item only." },
              estFat: { type: "number", description: "Fallback fat grams for this item only." },
            },
          },
        },
        hiddenCalorieRisks: {
          type: "array",
          description:
            "Likely hidden calorie sources to confirm with the user (oil, butter, sauce, dressing, cheese, frying, sugar, cream). Empty if none likely.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["risk", "question"],
            properties: {
              risk: { type: "string" },
              question: { type: "string", description: "A short user-facing question to confirm it." },
            },
          },
        },
        clarificationQuestions: {
          type: "array",
          description:
            "Questions to ask ONLY for items where confidence is below 0.80 and the answer meaningfully changes macros (protein type, carb type, portion). Empty otherwise.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["targetName", "reason", "question", "options"],
            properties: {
              targetName: {
                type: "string",
                description: "The detectedName of the food this question is about.",
              },
              reason: { type: "string" },
              question: { type: "string" },
              options: { type: "array", items: { type: "string" } },
            },
          },
        },
        biggestUncertainty: {
          type: "string",
          description:
            "The single biggest source of uncertainty in this estimate, in plain language (e.g. 'Amount of cooking oil on the potatoes').",
        },
        note: {
          type: "string",
          description: "Short neutral coaching note or caveat about the estimate (optional).",
        },
      },
    },
  },
};

const MEAL_ANALYSIS_SYSTEM_PROMPT = [
  "You are ALLUR's food recognition assistant inside a fitness tracking app.",
  "Analyze the uploaded meal photo. Your job is to IDENTIFY each visible food and ESTIMATE its portion — NOT to determine final nutrition numbers (the app looks macros up in a database).",
  "",
  "## Rules",
  "1. Identify each visible food item separately.",
  "2. Estimate portion size in grams for each item. Use MULTIPLE visual signals: plate/bowl diameter (a dinner plate is ~26cm/10in), the food's size relative to the plate, its volume, depth/thickness, number of distinct pieces, density, and whether it looks cooked or raw. Anchor to common serving-size references (a deck of cards ≈ 85g meat; a fist ≈ 1 cup; a cupped hand ≈ 40g of nuts/grains).",
  "3. Give an identification confidence (0-1) AND a separate portion confidence (0-1) for each item.",
  "4. Do not invent certainty. If unsure whether an item is chicken/salmon/pork/tofu, rice/pasta/potato, etc., list the top alternatives and lower the confidence.",
  "5. For EACH item, judge the cooking method (raw/grilled/baked/roasted/steamed/boiled/sauteed/fried/deep_fried, or 'unknown' if not visually clear), whether poultry/fish skin is left on (skinOn), and whether it has a breaded/battered/fried coating (breaded). These drive hidden cooking-oil calories — the app adds them on top of the database base, so report what you SEE rather than guessing high.",
  "6. If identification confidence is below 0.80 for a food that meaningfully affects macros (protein, carb, large fat source), add a clarification question with simple options.",
  "7. Detect likely hidden calorie sources (oil, butter, dressing, sauce, frying, cheese, cream, added sugar) and add a hidden-calorie risk to confirm.",
  "8. Do NOT ask about or over-prioritize tiny garnishes (lettuce, cucumber, tomato, herbs, lemon, spices).",
  "9. Provide a rough fallback macro estimate per item in case the food isn't in the database. Keep it internally consistent (protein×4 + carbs×4 + fat×9 ≈ calories).",
  "10. Set biggestUncertainty to the ONE thing that most limits this estimate's accuracy, in plain language (often the amount of cooking oil, a hidden sauce, or an obscured portion).",
  "11. Be conservative and transparent. Never claim exact precision — these are estimates. Never shame the user's food choices.",
  "12. If the photo is NOT food (a person, object, or scene), set isFood=false and return empty arrays.",
  "",
  "You MUST respond by calling the report_meal_analysis tool.",
].join("\n");

router.post(
  "/coach/analyze-meal",
  visionRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AnalyzeMealBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    const { photo, note } = parsed.data;
    if (!ALLOWED_PHOTO_RE.test(photo)) {
      res.status(400).json({ error: "A JPEG, PNG, or WebP image is required." });
      return;
    }
    const base64 = photo.slice(photo.indexOf(",") + 1);
    const decodedBytes = Math.floor((base64.length * 3) / 4);
    if (decodedBytes > MAX_PHOTO_BYTES) {
      res.status(413).json({ error: "That image is too large. Please use a smaller photo." });
      return;
    }

    const charge = await requireCredit(req, res, "photo");
    if (!charge) return;

    try {
      const content: VisionContentPart[] = [
        {
          type: "text",
          text: note
            ? `Analyze this meal photo and report via report_meal_analysis. User note: ${note}`
            : "Analyze this meal photo and report via report_meal_analysis:",
        },
        { type: "image_url", image_url: { url: photo } },
      ];

      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: MEAL_ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content },
        ],
        tools: [mealAnalysisTool],
        tool_choice: { type: "function", function: { name: "report_meal_analysis" } },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.find(
        (c) => c.type === "function" && c.function.name === "report_meal_analysis",
      );
      if (!toolCall || toolCall.type !== "function") {
        await charge.refund();
        req.log.warn("analyze-meal: model did not call the report tool");
        res.status(500).json({ error: "Couldn't analyze that photo. Please try a clearer photo." });
        return;
      }

      interface RawFood {
        detectedName?: string;
        category?: string;
        alternatives?: unknown;
        confidence?: number;
        grams?: number;
        portionConfidence?: number;
        cookingMethod?: string;
        skinOn?: boolean;
        breaded?: boolean;
        estCalories?: number;
        estProtein?: number;
        estCarbs?: number;
        estFat?: number;
      }
      let args: {
        isFood?: boolean;
        name?: string;
        foods?: RawFood[];
        hiddenCalorieRisks?: { risk?: string; question?: string }[];
        clarificationQuestions?: { targetName?: string; reason?: string; question?: string; options?: unknown }[];
        biggestUncertainty?: string;
        note?: string;
      };
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        await charge.refund();
        req.log.warn("analyze-meal: tool arguments were not valid JSON");
        res.status(500).json({ error: "Couldn't read the analysis result. Please try again." });
        return;
      }

      if (args.isFood === false) {
        await charge.refund();
        res.status(400).json({ error: "That photo doesn't look like food. Try a photo of your meal." });
        return;
      }

      const ALLOWED_CATEGORIES = new Set([
        "protein", "carb", "fat", "vegetable", "fruit", "dairy", "sauce", "drink", "dessert", "other",
      ]);
      const ALLOWED_METHODS = new Set([
        "raw", "grilled", "baked", "roasted", "steamed", "boiled", "sauteed", "fried", "deep_fried", "unknown",
      ]);
      const num01 = (n: unknown) => Math.min(1, Math.max(0, Number(n) || 0));
      const clampGrams = (n: unknown) => Math.min(2000, Math.max(1, Math.round(Number(n) || 0) || 100));
      const r = (n: unknown) => Math.max(0, Math.round(Number(n) || 0));

      const rawFoods = Array.isArray(args.foods) ? args.foods : [];
      const foods = rawFoods
        .filter((f): f is RawFood => !!f && typeof f.detectedName === "string" && f.detectedName.trim() !== "")
        .map((f) => {
          const detectedName = f.detectedName!.trim();
          const grams = clampGrams(f.grams);
          const cookingMethod: CookingMethod = ALLOWED_METHODS.has(String(f.cookingMethod))
            ? (String(f.cookingMethod) as CookingMethod)
            : "unknown";
          const skinOn = f.skinOn === true;
          const breaded = f.breaded === true;
          const match = matchFood(detectedName);
          let macros: FoodMacros;
          let source: "internal" | "estimated";
          let dbMatch: string | null;
          let foodId: string | null;
          if (match) {
            // Grounded in the DB base + a cooking-method adjustment (absorbed oil,
            // skin, breading) so the estimate reflects how it was actually cooked.
            macros = groundedMacros(match, grams, { method: cookingMethod, skinOn, breaded });
            source = "internal";
            dbMatch = match.canonicalName;
            foodId = match.id;
          } else {
            // The model's fallback estimate already reflects the visible cooking, so
            // we do NOT re-apply the adjustment here (would double-count).
            macros = {
              calories: r(f.estCalories),
              protein: r(f.estProtein),
              carbs: r(f.estCarbs),
              fat: r(f.estFat),
            };
            source = "estimated";
            dbMatch = null;
            foodId = null;
          }
          const category = ALLOWED_CATEGORIES.has(String(f.category)) ? String(f.category) : "other";
          return {
            detectedName,
            dbMatch,
            foodId,
            category,
            alternatives: Array.isArray(f.alternatives)
              ? f.alternatives.filter((a): a is string => typeof a === "string").slice(0, 5)
              : [],
            confidence: num01(f.confidence),
            portionConfidence: num01(f.portionConfidence),
            grams,
            source,
            cookingMethod,
            skinOn,
            breaded,
            ...macros,
          };
        });

      const totals = sumMacros(foods.map((f) => ({ calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat })));
      const minConfidence = foods.length ? Math.min(...foods.map((f) => f.confidence)) : 0.5;

      const clarifications = (Array.isArray(args.clarificationQuestions) ? args.clarificationQuestions : [])
        .filter((q) => q && typeof q.question === "string" && q.question.trim() !== "")
        .slice(0, 3)
        .map((q) => ({
          targetName: typeof q.targetName === "string" && q.targetName.trim() ? q.targetName.trim() : null,
          reason: typeof q.reason === "string" && q.reason.trim() ? q.reason.trim() : null,
          question: q.question!.trim(),
          options: Array.isArray(q.options)
            ? q.options.filter((o): o is string => typeof o === "string").slice(0, 8)
            : [],
        }));

      const hiddenRisks = (Array.isArray(args.hiddenCalorieRisks) ? args.hiddenCalorieRisks : [])
        .filter((h) => h && typeof h.risk === "string" && h.risk.trim() !== "")
        .slice(0, 3)
        .map((h) => ({
          risk: h.risk!.trim(),
          question: typeof h.question === "string" && h.question.trim()
            ? h.question.trim()
            : "Was oil, butter, dressing, or sauce added?",
        }));

      const validated = AnalyzeMealResponse.safeParse({
        name: (args.name ?? "Meal").trim() || "Meal",
        items: foods.map((f) => f.dbMatch ?? f.detectedName),
        foods,
        clarifications,
        hiddenRisks,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        confidence: confidenceLevel(minConfidence),
        biggestUncertainty:
          typeof args.biggestUncertainty === "string" && args.biggestUncertainty.trim()
            ? args.biggestUncertainty.trim()
            : null,
        note: args.note ?? null,
      });

      if (!validated.success) {
        await charge.refund();
        req.log.warn({ err: validated.error }, "analyze-meal: tool output failed validation");
        res.status(500).json({ error: "Couldn't read the analysis result. Please try again." });
        return;
      }

      res.json(validated.data);
    } catch (err) {
      await charge.refund();
      req.log.error({ err }, "analyze-meal request failed");
      res.status(500).json({ error: "Meal analysis is unavailable right now." });
    }
  },
);

// Structured-output tool for reading the lifted weight off a piece of equipment.
const weightAnalysisTool = {
  type: "function" as const,
  function: {
    name: "report_weight_reading",
    description:
      "Report the total working weight you can read from the equipment photo (loaded barbell incl. the bar, a single dumbbell, or a selectorized machine stack pin position), the unit, what you detected, and your confidence.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["readable", "weight", "unit", "confidence"],
      properties: {
        readable: {
          type: "boolean",
          description: "True only if a weight can actually be read or reasonably estimated from the photo.",
        },
        weight: {
          type: "number",
          description:
            "Total working weight. For a barbell, SUM all plates on BOTH sides PLUS the bar (assume a 20kg/45lb Olympic bar unless clearly otherwise). For a dumbbell, the weight of the single dumbbell. For a machine, the selected stack weight. 0 if not readable.",
        },
        unit: { type: "string", enum: ["kg", "lb"], description: "The unit of the weight." },
        equipment: {
          type: "string",
          description: "What you detected: 'barbell', 'dumbbell', 'machine stack', 'kettlebell', etc.",
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "Confidence in the reading.",
        },
        note: {
          type: "string",
          description: "Short caveat about the reading (optional), e.g. 'far-side plates partially hidden'.",
        },
      },
    },
  },
};

const WEIGHT_ANALYSIS_SYSTEM_PROMPT = [
  "You are ALLUR's equipment-reading assistant inside a workout logger.",
  "The user photographed the weight they are lifting. Read the TOTAL working weight.",
  "",
  "## Rules",
  "1. Barbell: identify every plate on both sides, sum them, and ADD the bar weight (standard Olympic bar = 20kg / 45lb unless it is clearly a lighter technique/EZ/fixed bar). Plates are usually labeled (e.g. 20, 15, 10, 5, 2.5 kg or 45, 35, 25, 10, 5 lb) and color-coded.",
  "2. Dumbbell: report the number printed on the single dumbbell.",
  "3. Machine: report the selected weight at the pin in the stack.",
  "4. Infer the unit from the plate labels/markings; if ambiguous, prefer kg and lower the confidence.",
  "5. If plates on the far side are hidden, assume the load is symmetric and note it.",
  "6. If you genuinely cannot read or estimate a weight, set readable=false and weight=0.",
  "7. Be honest about confidence — never claim exact precision.",
  "",
  "You MUST respond by calling the report_weight_reading tool.",
].join("\n");

router.post(
  "/coach/analyze-weight",
  visionRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Please sign in to use this feature." });
      return;
    }
    const parsed = AnalyzeWeightBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }
    const { photo, exerciseName } = parsed.data;
    if (!ALLOWED_PHOTO_RE.test(photo)) {
      res.status(400).json({ error: "A JPEG, PNG, or WebP image is required." });
      return;
    }
    const base64 = photo.slice(photo.indexOf(",") + 1);
    const decodedBytes = Math.floor((base64.length * 3) / 4);
    if (decodedBytes > MAX_PHOTO_BYTES) {
      res.status(413).json({ error: "That image is too large. Please use a smaller photo." });
      return;
    }

    try {
      const content: VisionContentPart[] = [
        {
          type: "text",
          text: exerciseName
            ? `Read the total working weight from this photo and report via report_weight_reading. Exercise: ${exerciseName}.`
            : "Read the total working weight from this photo and report via report_weight_reading:",
        },
        { type: "image_url", image_url: { url: photo } },
      ];

      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        max_completion_tokens: 1024,
        messages: [
          { role: "system", content: WEIGHT_ANALYSIS_SYSTEM_PROMPT },
          { role: "user", content },
        ],
        tools: [weightAnalysisTool],
        tool_choice: { type: "function", function: { name: "report_weight_reading" } },
      });

      const toolCall = completion.choices[0]?.message?.tool_calls?.find(
        (c) => c.type === "function" && c.function.name === "report_weight_reading",
      );
      if (!toolCall || toolCall.type !== "function") {
        req.log.warn("analyze-weight: model did not call the report tool");
        res.status(500).json({ error: "Couldn't read the weight. Please try a clearer photo." });
        return;
      }

      let args: {
        readable?: boolean;
        weight?: number;
        unit?: string;
        equipment?: string;
        confidence?: string;
        note?: string;
      };
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        req.log.warn("analyze-weight: tool arguments were not valid JSON");
        res.status(500).json({ error: "Couldn't read the analysis result. Please try again." });
        return;
      }

      const validated = AnalyzeWeightResponse.safeParse({
        readable: Boolean(args.readable),
        weight: typeof args.weight === "number" && args.weight > 0 ? Math.round(args.weight * 10) / 10 : 0,
        unit: args.unit === "lb" ? "lb" : "kg",
        equipment: typeof args.equipment === "string" && args.equipment.trim() ? args.equipment.trim() : null,
        confidence: ["low", "medium", "high"].includes(args.confidence ?? "") ? args.confidence : "low",
        note: typeof args.note === "string" && args.note.trim() ? args.note.trim() : null,
      });

      if (!validated.success) {
        req.log.warn({ err: validated.error }, "analyze-weight: tool output failed validation");
        res.status(500).json({ error: "Couldn't read the analysis result. Please try again." });
        return;
      }

      res.json(validated.data);
    } catch (err) {
      req.log.error({ err }, "analyze-weight request failed");
      res.status(500).json({ error: "Weight reading is unavailable right now." });
    }
  },
);

// --- AI-enhanced goal photo ------------------------------------------------
// Turns the user's own progress photo into a realistic "goal" version of
// THEMSELVES (image-to-image edit), so the goal preview compares the user
// against their own future physique instead of a generic reference model.
router.post(
  "/coach/enhance-goal-photo",
  visionRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body as {
      photo?: unknown;
      profile?: { gender?: unknown; targetPhysique?: unknown; goal?: unknown };
    };
    const photo = typeof body?.photo === "string" ? body.photo : "";
    if (!ALLOWED_PHOTO_RE.test(photo)) {
      res.status(400).json({ error: "A JPEG, PNG, or WebP image is required." });
      return;
    }
    const base64 = photo.slice(photo.indexOf(",") + 1);
    const decodedBytes = Math.floor((base64.length * 3) / 4);
    if (decodedBytes > MAX_PHOTO_BYTES) {
      res.status(413).json({ error: "That image is too large. Please use a smaller photo." });
      return;
    }

    const gender = typeof body?.profile?.gender === "string" ? body.profile.gender : "";
    const targetPhysique =
      typeof body?.profile?.targetPhysique === "string" ? body.profile.targetPhysique : "";
    const goal = typeof body?.profile?.goal === "string" ? body.profile.goal : "";

    const charge = await requireCredit(req, res, "photo");
    if (!charge) return;

    try {
      const mimeMatch = /^data:(image\/(?:jpeg|png|webp));base64,/i.exec(photo);
      const mimeType = mimeMatch?.[1]?.toLowerCase() ?? "image/jpeg";
      const imageBuffer = Buffer.from(base64, "base64");

      const prompt = [
        "Edit this fitness progress photo to show the SAME person after a successful, realistic training transformation.",
        "Keep their identity completely intact: same face, skin tone, hair, tattoos, pose, clothing, lighting, and background.",
        "Only change the physique: visibly lower body fat and improved muscle definition and fullness, at a level genuinely achievable naturally in about 6-12 months of consistent training and nutrition.",
        targetPhysique ? `Their target look is: ${targetPhysique}.` : "",
        goal ? `Their training goal is: ${goal}.` : "",
        gender ? `The person is ${gender.toLowerCase()}.` : "",
        "The result must look like an authentic unedited photo of that same person — natural, believable, and NOT an exaggerated bodybuilder transformation.",
      ]
        .filter(Boolean)
        .join(" ");

      const edited = await editImageBuffer(imageBuffer, prompt, {
        mimeType,
        size: "1024x1536",
        quality: "medium",
      });
      if (!edited.length) {
        await charge.refund();
        res.status(500).json({ error: "Couldn't generate your goal photo. Please try again." });
        return;
      }

      res.json({ image: `data:image/png;base64,${edited.toString("base64")}` });
    } catch (err) {
      await charge.refund();
      req.log.error({ err }, "enhance-goal-photo request failed");
      res.status(500).json({ error: "Goal photo generation is unavailable right now." });
    }
  },
);

export default router;
