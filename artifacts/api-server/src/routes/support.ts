import { Router, type IRouter, type Request, type Response } from "express";
import { makeRateLimit } from "../lib/rateLimit";
import { sendEmail, isEmailConfigured } from "../lib/email";

const router: IRouter = Router();

// Per-IP limiter: a handful of reports a minute is plenty for a real person and
// stops the endpoint being abused to spam the support inbox.
const rateLimit = makeRateLimit("bug-report", 5, 60_000);

// Where user bug reports land. Overridable via env so it isn't hard-pinned to a
// personal address, but defaults to the owner's inbox.
const SUPPORT_EMAIL = process.env["SUPPORT_EMAIL"] || "micahjcopy@gmail.com";

const asString = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Receive a user-submitted bug report (from the crash screen or the "Report a
 * problem" form) and email it to the support inbox. No auth required — crashes
 * can happen while signed out — but rate-limited and length-capped. If email
 * isn't configured the caller gets a clear, non-leaky error.
 */
router.post("/support/bug-report", rateLimit, async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  const message = asString(body["message"], 5000);
  if (message.length < 3) {
    res.status(400).json({ error: "Please add a short description of the problem." });
    return;
  }

  const kind = body["kind"] === "crash" ? "crash" : "feedback";
  const errorCode = asString(body["errorCode"], 120);
  const sentryId = asString(body["sentryId"], 120);
  const path = asString(body["path"], 300);
  const userAgent = asString(body["userAgent"], 400);
  const reporterEmailRaw = asString(body["email"], 200);
  const reporterEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(reporterEmailRaw) ? reporterEmailRaw : "";

  // Best-effort account context (present only when the reporter is signed in).
  let accountLine = "Not signed in";
  try {
    if (req.isAuthenticated() && req.user) {
      const u = req.user as { id?: string; email?: string | null; username?: string | null };
      accountLine = [u.username, u.email, u.id ? `id:${u.id}` : ""].filter(Boolean).join(" · ") || accountLine;
    }
  } catch {
    /* auth not available — leave as "Not signed in" */
  }

  if (!isEmailConfigured()) {
    req.log.error("bug report received but SMTP email is not configured");
    res.status(503).json({ error: "Bug reporting isn't set up yet. Please try again later." });
    return;
  }

  const label = kind === "crash" ? "Crash report" : "Bug report";
  const ref = errorCode || sentryId || "—";
  const subject = `[ALLUR] ${label}${errorCode ? ` #${errorCode}` : ""}: ${message.slice(0, 60)}`;

  const rows: [string, string][] = [
    ["Type", label],
    ["Error code", ref],
    ["Sentry ID", sentryId || "—"],
    ["Reporter email", reporterEmail || "(not provided)"],
    ["Account", accountLine],
    ["Page", path || "—"],
    ["Device / browser", userAgent || "—"],
  ];

  const text =
    `${label}\n\n` +
    `What happened:\n${message}\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    `\n`;

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.5">` +
    `<h2 style="margin:0 0 12px">${label}</h2>` +
    `<p style="white-space:pre-wrap;background:#f5f5f7;border-radius:8px;padding:12px 14px;margin:0 0 16px">${escapeHtml(message)}</p>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td>` +
          `<td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`,
      )
      .join("") +
    `</table></div>`;

  try {
    // If the reporter gave an email, set it as reply-to via the message body note
    // (sendEmail doesn't expose replyTo); the address is included in the table so
    // you can reply directly from your client.
    await sendEmail({ to: SUPPORT_EMAIL, subject, html, text });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "failed to send bug report email");
    res.status(500).json({ error: "Couldn't send your report. Please try again." });
  }
});

export default router;
