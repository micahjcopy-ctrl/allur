import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/* ===========================================================================
   Web Push delivery for Squad notifications. Coach-voice only, and always a
   companion to the in-app notification center — if VAPID keys are missing or
   a send fails, the product keeps working and the message still shows in-app.
   =========================================================================== */

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    configured = false;
    return configured;
  }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:micahjcopy@gmail.com", pub, priv);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function vapidPublicKey(): string | null {
  return pushConfigured() ? (process.env.VAPID_PUBLIC_KEY as string) : null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Send to every subscription a user has (multiple devices). Dead subscriptions
// (410 Gone / 404) are pruned so the table stays clean. Never throws.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushConfigured()) return;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.userId, userId));
    if (subs.length === 0) return;

    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/squad",
    });

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 24 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await db
              .delete(pushSubscriptionsTable)
              .where(eq(pushSubscriptionsTable.endpoint, s.endpoint))
              .catch(() => {});
          }
        }
      }),
    );
  } catch {
    /* push is best-effort by design */
  }
}
