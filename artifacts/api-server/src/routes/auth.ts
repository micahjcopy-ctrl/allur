import * as oidc from "openid-client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  LogoutMobileSessionResponse,
  RegisterAccountBody,
  RegisterAccountResponse,
  LoginAccountBody,
  LoginAccountResponse,
  LogoutAccountResponse,
  RequestPasswordResetBody,
  RequestPasswordResetResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
} from "@workspace/api-zod";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { sendEmail } from "../lib/email";
import { publicBaseUrl } from "../lib/appUrl";
import { makeRateLimit } from "../lib/rateLimit";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const router: IRouter = Router();

// Per-IP limiter for the credential auth endpoints. Blunts online password
// guessing on /auth/login and registration abuse on /auth/register. Backed by a
// shared Postgres counter (see lib/rateLimit.ts) so the limit holds across all
// serverless instances — an in-memory Map only ever limits per-instance on
// Vercel and is trivially bypassed by spreading requests across cold starts.
const authRateLimit = makeRateLimit("auth", 10, 60_000);

// Replit OIDC is only available when REPL_ID is provisioned (i.e. running on
// Replit). Off Replit (e.g. Vercel) the app uses email/username/password auth
// exclusively, so these routes short-circuit with a clear 404 instead of
// throwing a 500 from getOidcConfig().
function oidcEnabled(): boolean {
  return !!process.env["REPL_ID"];
}

function requireOidc(_req: Request, res: Response, next: NextFunction): void {
  if (!oidcEnabled()) {
    res
      .status(404)
      .json({ error: "Single sign-on is not enabled. Use email and password." });
    return;
  }
  next();
}

function getOrigin(req: Request): string {
  // Prefer the canonical published origin (APP_URL / VERCEL_URL / REPLIT_DOMAINS)
  // so security-sensitive links (password reset emails, OIDC callbacks) can't be
  // poisoned via attacker-controlled Host / X-Forwarded-Host headers. Fall back
  // to request headers only in dev where none of those are set.
  const canonical = publicBaseUrl();
  if (canonical) return canonical;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as
      | string
      | null,
  };

  // A custom email/password account may already own this email under a
  // different id (its own generated uuid). Linking to that row instead of
  // inserting avoids violating the unique-email constraint, which would
  // otherwise break OIDC login for anyone who first signed up with credentials.
  if (userData.email) {
    const [existingByEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, userData.email));
    if (existingByEmail && existingByEmail.id !== userData.id) {
      const [linked] = await db
        .update(usersTable)
        .set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.id, existingByEmail.id))
        .returning();
      return linked;
    }
  }

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/register", authRateLimit, async (req: Request, res: Response) => {
  const parsed = RegisterAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim();

  const existing = await db
    .select({ id: usersTable.id, email: usersTable.email, username: usersTable.username })
    .from(usersTable)
    .where(
      or(
        eq(usersTable.email, email),
        sql`lower(${usersTable.username}) = ${username.toLowerCase()}`,
      ),
    );

  if (existing.some((u) => u.email === email)) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }
  if (existing.some((u) => u.username?.toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ error: "That username is taken." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  let dbUser;
  try {
    [dbUser] = await db
      .insert(usersTable)
      .values({ email, username, passwordHash })
      .returning();
  } catch (err) {
    req.log.error({ err }, "Account registration failed");
    res.status(409).json({ error: "That email or username is already in use." });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json(RegisterAccountResponse.parse({ user: sessionData.user }));
});

router.post("/auth/login", authRateLimit, async (req: Request, res: Response) => {
  const parsed = LoginAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  // Resolve deterministically: an identifier containing "@" is treated as an
  // email, otherwise as a username. Usernames are constrained to exclude "@"
  // at registration, so the two namespaces never overlap and a login can never
  // match an ambiguous pair of rows.
  const identifier = parsed.data.identifier.trim();
  const matches = await db
    .select()
    .from(usersTable)
    .where(
      identifier.includes("@")
        ? eq(usersTable.email, identifier.toLowerCase())
        : sql`lower(${usersTable.username}) = ${identifier.toLowerCase()}`,
    );

  // Username matching is case-insensitive, so in the unlikely event legacy data
  // holds two rows differing only by case, refuse to guess which account to log
  // in (selecting the first row could authenticate the wrong person). Registration
  // now blocks case-variant duplicates, so this can only ever be pre-existing data.
  if (matches.length > 1) {
    req.log.error(
      { kind: identifier.includes("@") ? "email" : "username" },
      "Ambiguous login: multiple accounts match the identifier case-insensitively",
    );
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const dbUser = matches[0];
  if (!dbUser?.passwordHash) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const valid = await bcrypt.compare(parsed.data.password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json(LoginAccountResponse.parse({ user: sessionData.user }));
});

router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json(LogoutAccountResponse.parse({ success: true }));
});

// Password reset tokens live for one hour and are single-use. We email the raw
// token but only ever store its SHA-256 hash, so the DB never holds anything
// usable to reset a password.
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const hashResetToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

function resetEmailBody(link: string): { html: string; text: string } {
  const text = [
    "We received a request to reset your ALLUR password.",
    "",
    `Reset your password: ${link}`,
    "",
    "This link expires in 1 hour and can be used once.",
    "If you didn't request this, you can safely ignore this email — your password won't change.",
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">Reset your ALLUR password</h2>
      <p style="margin:0 0 16px;line-height:1.5">We received a request to reset your password. Tap the button below to choose a new one.</p>
      <p style="margin:0 0 24px">
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Reset password</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.5">This link expires in 1 hour and can be used once.</p>
      <p style="margin:0;font-size:13px;color:#666;line-height:1.5">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    </div>`;
  return { html, text };
}

// Always returns 200 with the same body whether or not the email matches an
// account, so an attacker can't use this endpoint to discover which emails are
// registered. OIDC-only accounts (no passwordHash) get no email since they have
// no password to reset.
router.post(
  "/auth/forgot-password",
  authRateLimit,
  async (req: Request, res: Response) => {
    const parsed = RequestPasswordResetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const email = parsed.data.email.trim().toLowerCase();
    const ok = RequestPasswordResetResponse.parse({ success: true });

    const [user] = await db
      .select({ id: usersTable.id, passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.email, email));

    if (!user?.passwordHash) {
      // No credential account for this email — respond identically (no leak).
      res.json(ok);
      return;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    try {
      // Invalidate any outstanding tokens for this user, then issue a fresh one.
      // Wrapped in a transaction so concurrent forgot requests for the same user
      // can't interleave and leave multiple valid tokens.
      await db.transaction(async (tx) => {
        await tx
          .delete(passwordResetTokensTable)
          .where(eq(passwordResetTokensTable.userId, user.id));
        await tx.insert(passwordResetTokensTable).values({
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt,
        });
      });

      const link = `${getOrigin(req)}/reset-password?token=${rawToken}`;
      const { html, text } = resetEmailBody(link);
      await sendEmail({
        to: email,
        subject: "Reset your ALLUR password",
        html,
        text,
      });
    } catch (err) {
      // Log for ops, but never reveal failure details to the caller.
      req.log.error({ err }, "Password reset request failed");
    }

    res.json(ok);
  },
);

router.post(
  "/auth/reset-password",
  authRateLimit,
  async (req: Request, res: Response) => {
    const parsed = ResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
      return;
    }

    const tokenHash = hashResetToken(parsed.data.token.trim());

    // Atomically claim the token: a single conditional UPDATE flips usedAt only
    // if the token is still unused and unexpired, returning the row. Two
    // concurrent requests can't both win this race — only the first sees a
    // returned row — so the link is strictly single-use.
    const [claimed] = await db
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokensTable.tokenHash, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokensTable.userId });

    if (!claimed) {
      res
        .status(400)
        .json({ error: "This reset link is invalid or has expired." });
      return;
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db
      .update(usersTable)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(usersTable.id, claimed.userId));

    res.json(ResetPasswordResponse.parse({ success: true }));
  },
);

router.get("/login", requireOidc, async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", requireOidc, async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      username: dbUser.username,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", requireOidc, async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
