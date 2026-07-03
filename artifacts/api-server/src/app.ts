import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { authMiddleware } from "./middlewares/authMiddleware";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./lib/stripe/webhookHandlers";

const app: Express = express();

// Don't advertise the framework (minor fingerprinting reduction).
app.disable("x-powered-by");

// Behind Vercel's / Replit's reverse proxy: trust the forwarding hop so req.ip
// reflects the real client (needed for per-IP rate limiting, otherwise every
// request looks like it comes from the single proxy IP).
app.set("trust proxy", true);

// Defense-in-depth security headers on every API response. The static app
// shell + assets also get these at the Vercel edge (see vercel.json); the
// serverless API function sets them itself so API responses are covered too.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS: reflect credentials ONLY for our own web origins instead of echoing
// any origin. Requests with no Origin header (same-origin XHR, native mobile
// app, server-to-server) are always allowed — CORS only constrains browser
// cross-origin calls, so this can't break the same-origin web app.
const STATIC_ALLOWED_ORIGINS = new Set(
  [
    process.env.APP_URL,
    "http://localhost:5173",
    "http://localhost:3000",
  ].filter((o): o is string => !!o),
);

function isAllowedOrigin(origin: string): boolean {
  if (STATIC_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    // This project's production + preview deployments on Vercel.
    return host === "allur-mauve.vercel.app" ||
      (host.startsWith("allur-") && host.endsWith(".vercel.app"));
  } catch {
    return false;
  }
}

app.use(
  cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin || isAllowedOrigin(origin)) {
        cb(null, true);
        return;
      }
      // Not an allowed cross-origin caller: respond without CORS headers so the
      // browser blocks the response, but don't throw (keeps the request cheap).
      cb(null, false);
    },
  }),
);
app.use(cookieParser());

// Stripe webhook MUST be registered before express.json() — it needs the raw
// request body Buffer to verify the signature.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0]! : signature;
      if (!Buffer.isBuffer(req.body)) {
        req.log.error("Stripe webhook body is not a Buffer (express.json ran first)");
        res.status(500).json({ error: "Webhook processing error" });
        return;
      }
      await WebhookHandlers.processWebhook(req.body, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      req.log.error({ err }, "Stripe webhook processing failed");
      res.status(400).json({ error: "Webhook processing error" });
    }
  },
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
