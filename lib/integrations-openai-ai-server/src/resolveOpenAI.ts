import OpenAI from "openai";

/**
 * Resolve OpenAI credentials in a host-agnostic way.
 *
 * - On Replit, the AI integration injects `AI_INTEGRATIONS_OPENAI_API_KEY` and
 *   `AI_INTEGRATIONS_OPENAI_BASE_URL` (a proxy URL).
 * - Everywhere else (Vercel, local, etc.) set a real `OPENAI_API_KEY` and
 *   optionally `OPENAI_BASE_URL`.
 *
 * We intentionally do NOT throw at import time: a missing key must not crash the
 * whole server at cold start (that would take down auth, billing, etc.). Instead
 * we construct the client with a placeholder key so module load always succeeds;
 * the relevant AI request then fails at runtime with a clear 401 until a real
 * key is configured. Call `hasOpenAIKey()` to gate features cleanly.
 */
export function getOpenAIApiKey(): string | undefined {
  return (
    process.env["OPENAI_API_KEY"] ||
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ||
    undefined
  );
}

export function getOpenAIBaseURL(): string | undefined {
  return (
    process.env["OPENAI_BASE_URL"] ||
    process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"] ||
    undefined
  );
}

export function hasOpenAIKey(): boolean {
  return !!getOpenAIApiKey();
}

export function createOpenAIClient(): OpenAI {
  const apiKey = getOpenAIApiKey();
  const baseURL = getOpenAIBaseURL();
  return new OpenAI({
    // Placeholder keeps construction from throwing when unconfigured; real calls
    // will 401 until a key is set.
    apiKey: apiKey || "OPENAI_API_KEY_NOT_CONFIGURED",
    ...(baseURL ? { baseURL } : {}),
  });
}
