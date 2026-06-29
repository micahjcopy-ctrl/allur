---
name: FitCoach per-user persistence
description: Traps when persisting a single shared client context (FitCoachContext) per-user to a backend blob.
---

Persisting a single app-wide React context per logged-in user (one JSONB blob via GET/PUT `/me/fitness-state`) has three non-obvious traps that all need an explicit hydration gate keyed by userId:

1. **Write-before-read clobber:** a debounced auto-saver will fire with empty defaults on first mount and overwrite existing server data. Gate the writer on a ref (`hydratedUserIdRef`) that is only set after the initial read settles. On a *failed* read, leave persistence disabled rather than saving defaults.
2. **Account-switch leak (A→B without logout):** when userId changes, the context still holds A's in-memory data while B's fetch is in flight. Flip a `hydrated` flag false on any userId change and block route rendering (spinner in the auth gate) until B's state settles — otherwise A's data renders under B.
3. **Admin/preview seed clobber:** entering an owner-only demo that seeds throwaway data into the *same* context will persist that seed to the real account. Set a per-tab taint ref to disable persistence while in preview; clear it (and force a fresh re-hydrate) on exit AND on logout.

**Why:** all three were flagged in code review; they are silent data-loss / privacy bugs, not type errors.
**How to apply:** any time a shared client store is both auto-saved and multi-user, gate hydrate + save on a userId-keyed ref and expose a `hydrated` boolean to the router. Keep ephemeral slices (chat) out of the persisted blob.
