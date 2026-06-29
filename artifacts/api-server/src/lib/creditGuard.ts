import type { Request, Response } from "express";
import { spendCredit, refundCredit, type CreditType } from "./credits";

export interface CreditCharge {
  /** Give the spent credit back — call when the paid call fails after spending. */
  refund(): Promise<void>;
}

/**
 * Auth-gate a paid endpoint and spend one credit of `type`.
 *
 * On success returns a charge handle (with a refund() for failure paths). On
 * failure it has ALREADY written the response (401 unauthenticated / 402 out of
 * credits) and returns null — the caller must just `return`.
 */
export async function requireCredit(
  req: Request,
  res: Response,
  type: CreditType,
): Promise<CreditCharge | null> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Please sign in to use this feature." });
    return null;
  }

  const userId = req.user.id;
  const result = await spendCredit(userId, type);
  if (!result.ok) {
    // Free users have no access to this feature at all — prompt them to
    // subscribe to Base ($12.99). Base users who exhausted the type get a 402.
    if (result.plan === "free") {
      res.status(403).json({
        error:
          "This feature is part of ALLUR Base. Subscribe to unlock your AI coach, plan updates, and macro tracking.",
        type: "needs_subscription",
        creditType: type,
      });
      return null;
    }
    res.status(402).json({
      error: "You're out of credits for this feature.",
      type: "out_of_credits",
      creditType: type,
      credits: result.credits,
    });
    return null;
  }

  return {
    async refund() {
      await refundCredit(userId, type);
    },
  };
}
