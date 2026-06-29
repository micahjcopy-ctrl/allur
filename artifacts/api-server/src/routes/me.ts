import { Router, type IRouter, type Request, type Response } from "express";
import { db, userFitnessStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  GetMyCreditsResponse,
  GetMyFitnessStateResponse,
  GetMySubscriptionResponse,
  SaveMyFitnessStateBody,
  SaveMyFitnessStateResponse,
} from "@workspace/api-zod";
import { getCreditState } from "../lib/credits";
import { getSubscriptionSummary } from "../lib/stripe/plan";

const router: IRouter = Router();

// Current plan + remaining usage credits for the authenticated user. Credits are
// server-authoritative (see lib/credits.ts); this is the read side the client UI
// renders from. Applies the monthly reset lazily on read.
router.get("/me/credits", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const state = await getCreditState(req.user.id);
  res.json(GetMyCreditsResponse.parse(state));
});

// Subscription summary (plan + trial/cancel state + whether the user has ever
// subscribed). Drives the post-onboarding payment gate and the Account page.
router.get("/me/subscription", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const summary = await getSubscriptionSummary(req.user.id);
  res.json(GetMySubscriptionResponse.parse(summary));
});

// Load the authenticated user's persisted fitness state. Returns null when the
// user has never saved any state yet (fresh account).
router.get("/me/fitness-state", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const [row] = await db
    .select()
    .from(userFitnessStateTable)
    .where(eq(userFitnessStateTable.userId, req.user.id));

  res.json(GetMyFitnessStateResponse.parse({ state: row?.state ?? null }));
});

// Persist (upsert) the authenticated user's fitness state blob.
router.put("/me/fitness-state", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const parsed = SaveMyFitnessStateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  const [row] = await db
    .insert(userFitnessStateTable)
    .values({ userId: req.user.id, state: parsed.data.state })
    .onConflictDoUpdate({
      target: userFitnessStateTable.userId,
      set: { state: parsed.data.state, updatedAt: new Date() },
    })
    .returning();

  res.json(
    SaveMyFitnessStateResponse.parse({ success: true, updatedAt: row.updatedAt }),
  );
});

export default router;
