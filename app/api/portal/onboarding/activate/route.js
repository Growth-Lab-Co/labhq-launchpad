import { NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/portalSession";
import { redeemInviteCode } from "@/lib/inviteCodes";
import { updateOnboarding, maybeCompleteOnboarding, publicAccount } from "@/lib/accounts";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 15;

// Invite codes are the only live activation path today - Stripe Checkout
// (app/api/portal/onboarding/checkout) stays inert until real keys are set.
export async function POST(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({
    route: "activate",
    ip,
    max: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
    );
  }

  const { code } = await req.json().catch(() => ({}));
  const result = await redeemInviteCode(code, session.accountId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await updateOnboarding(session.accountId, { activated: true, planLabel: result.planLabel });
  const account = await maybeCompleteOnboarding(session.accountId);
  return NextResponse.json({ account: publicAccount(account) });
}
