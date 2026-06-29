import app from "./app";
import { ensureStripeInitialized } from "./lib/init";

/**
 * Serverless entry (Vercel). An Express app instance is itself a
 * `(req, res) => void` request handler, so we export it directly. Vercel routes
 * `/api/*` here (see vercel.json); Express then matches on the original req.url.
 *
 * Stripe init is fired once per cold start, non-blocking, so requests are never
 * delayed waiting on it.
 */
void ensureStripeInitialized();

export default app;
