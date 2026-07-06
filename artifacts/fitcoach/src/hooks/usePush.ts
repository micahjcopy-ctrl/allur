import { useCallback, useEffect, useState } from "react";

const apiBase = () => import.meta.env.BASE_URL.replace(/\/+$/, "");

/**
 * Push-notification state machine, shared by onboarding, the dashboard bell,
 * and the Squad page.
 *
 * - "unsupported"  browser can't do web push (e.g. Safari tab on iOS — push
 *                  only works once ALLUR is installed to the home screen)
 * - "unavailable"  server has no VAPID keys configured
 * - "blocked"      user denied the permission at the browser level
 * - "off"          available, not subscribed yet (also the network-error
 *                  fallback so a blip never reads as "unavailable")
 * - "on"           subscribed
 */
export type PushState = "unsupported" | "unavailable" | "off" | "on" | "blocked";

export function usePush() {
  const supported =
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [state, setState] = useState<PushState>(supported ? "off" : "unsupported");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      try {
        const res = await fetch(`${apiBase()}/api/squad/push/public-key`, { credentials: "include" });
        const { enabled } = (await res.json()) as { enabled: boolean };
        if (!enabled) {
          setState("unavailable");
          return;
        }
        if (Notification.permission === "denied") {
          setState("blocked");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off"); // transient failure — enabling retries and reports
      }
    })();
  }, [supported]);

  /** Request permission + subscribe. Returns the resulting state. */
  const enable = useCallback(async (): Promise<PushState> => {
    if (!supported) return "unsupported";
    if (busy) return state;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        const next = permission === "denied" ? "blocked" : "off";
        setState(next);
        return next;
      }
      const res = await fetch(`${apiBase()}/api/squad/push/public-key`, { credentials: "include" });
      const { key } = (await res.json()) as { key: string | null };
      if (!key) {
        setState("unavailable");
        return "unavailable";
      }
      const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
      const appKey = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      const json = sub.toJSON();
      await fetch(`${apiBase()}/api/squad/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });
      setState("on");
      return "on";
    } catch {
      // Leave state as-is; caller decides how to tell the user.
      throw new Error("Couldn't enable notifications. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }, [supported, busy, state]);

  return { state, busy, supported, enable };
}
