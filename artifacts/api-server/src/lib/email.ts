// Provider-agnostic transactional email.
//
// Originally this sent through the Replit Gmail connector. Off Replit, configure
// SMTP via env (works with Gmail app-passwords, Resend SMTP, Postmark, SES, etc.):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
//
// Fail-soft: if SMTP isn't configured we throw a clear error. The only caller
// (password reset) already catches and never reveals failure to the client, so
// the app keeps working with email disabled.
import nodemailer, { type Transporter } from "nodemailer";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const sanitizeHeader = (value: string): string =>
  value.replace(/[\r\n]+/g, " ").trim();

let cachedTransport: Transporter | null = null;

function getTransport(): Transporter | null {
  if (cachedTransport) return cachedTransport;

  const host = process.env["SMTP_HOST"];
  const user = process.env["SMTP_USER"];
  // Strip whitespace: Gmail shows app passwords in spaced groups
  // ("abcd efgh ijkl mnop") but SMTP auth expects them with no spaces.
  const pass = process.env["SMTP_PASS"]?.replace(/\s+/g, "");
  if (!host || !user || !pass) return null;

  const port = Number(process.env["SMTP_PORT"] ?? 587);
  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user, pass },
  });
  return cachedTransport;
}

export function isEmailConfigured(): boolean {
  return getTransport() !== null;
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    throw new Error(
      "Email is not configured (set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS).",
    );
  }

  const from =
    process.env["EMAIL_FROM"] ||
    process.env["SMTP_USER"] ||
    "no-reply@allur.app";

  await transport.sendMail({
    from,
    to: sanitizeHeader(args.to),
    subject: sanitizeHeader(args.subject),
    text: args.text,
    html: args.html,
  });
}
