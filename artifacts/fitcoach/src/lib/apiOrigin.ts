/* ===========================================================================
   apiOrigin.ts — where the API lives, and how we authenticate to it.

   READ THIS BEFORE CHANGING ANY fetch() CALL.

   On the web, the app and the API share an origin, so every request can be a
   relative path (`/api/coach/chat`) and the browser attaches the `sid` session
   cookie automatically. That is how the whole client was written.

   Inside the Capacitor native shell there is no shared origin. The webview
   serves the bundled assets from `capacitor://localhost` (iOS) or
   `https://localhost` (Android) — capacitor.config.ts deliberately does NOT
   point the webview at the live site, because a webview loading a remote URL
   is the textbook Guideline 4.2 "repackaged website" rejection.

   Two consequences, and both are fatal if ignored:

   1. A relative `/api/...` path resolves against the LOCAL BUNDLE and 404s.
      Every API call must be absolute on native.

   2. The session cookie is `sameSite: "lax"`, so the browser will not send it
      on a cross-site request — which is exactly what native requests now are.
      Native therefore authenticates with a bearer token instead. The server
      already supports this: getSessionId() checks `Authorization: Bearer`
      before falling back to the cookie, and the OpenAPI spec documents it.

   Web behaviour is unchanged by this file: apiOrigin() returns the same empty
   string the old `apiBase()` helpers did, and no token is ever attached.
   =========================================================================== */

import { isNative } from "./native";

/**
 * Absolute origin of the API when running natively.
 *
 * Overridable via VITE_API_ORIGIN so a native build can be pointed at a
 * preview deployment. Falls back to production, because a native build with
 * no origin configured is useless — better a wrong host than silent 404s.
 */
const NATIVE_API_ORIGIN = (
  (import.meta.env.VITE_API_ORIGIN as string | undefined) || "https://getallur.com"
).replace(/\/+$/, "");

/**
 * Prefix for every API request.
 *
 * Web  → "" (or the Replit base path), i.e. relative — unchanged behaviour.
 * Native → the absolute production origin.
 */
export function apiOrigin(): string {
  if (isNative()) return NATIVE_API_ORIGIN;
  return import.meta.env.BASE_URL.replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Native session token
// ---------------------------------------------------------------------------

const TOKEN_KEY = "allur_session_token";

/**
 * The session token is the session id — the same opaque value the `sid` cookie
 * carries on web. It is only ever stored on native; on web the cookie remains
 * the only credential and nothing is written here.
 *
 * Stored in localStorage rather than a secure keychain: WKWebView scopes
 * localStorage to the app's own data container, so it isn't readable by other
 * apps, and adding a keychain plugin for a session id that already expires
 * server-side (SESSION_TTL, 7 days) isn't worth the dependency. Revisit if the
 * token ever becomes long-lived.
 */
export function getAuthToken(): string | null {
  if (!isNative()) return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null): void {
  if (!isNative()) return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — the user will simply have to sign in again */
  }
}

/**
 * Headers to merge into every authenticated request.
 *
 * Returns {} on web, so existing call sites are byte-for-byte unaffected.
 */
export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Marks the request as coming from the native shell.
 *
 * The server uses this to decide whether to include the session token in a
 * login/register response body — it can't be read from the httpOnly cookie,
 * and native has no usable cookie anyway.
 */
export function nativeClientHeaders(): Record<string, string> {
  return isNative() ? { "X-Allur-Client": "native" } : {};
}

/**
 * The standard init for an authenticated API call.
 *
 * `credentials: "include"` is kept for web (where the cookie is the
 * credential) and is harmless on native (there is no cookie to send).
 */
export function apiInit(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    credentials: "include",
    headers: { ...authHeaders(), ...nativeClientHeaders(), ...(init.headers ?? {}) },
  };
}

/**
 * Call the API. Takes a root-relative path (`/api/coach/chat`) and handles the
 * origin and credentials for whichever platform it's running on.
 *
 * Use this instead of `fetch` for anything hitting our own API. A bare
 * `fetch("/api/...")` works on web and silently 404s on device, which is the
 * single most expensive bug class in this codebase.
 */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiOrigin()}${path}`, apiInit(init));
}
