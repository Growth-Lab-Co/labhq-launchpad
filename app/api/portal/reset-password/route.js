import { NextResponse } from "next/server";
import { redeemResetToken } from "@/lib/passwordResets";
import { setAccountPassword, getAccountById, publicAccount } from "@/lib/accounts";
import { createSession, setSessionCookie, destroyAllSessions } from "@/lib/portalSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function POST(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({
    route: "reset-password",
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

  try {
    const { token, password } = await req.json();
    const accountId = await redeemResetToken(token);
    if (!accountId) {
      return NextResponse.json({ error: "That reset link is invalid or has expired." }, { status: 400 });
    }

    await setAccountPassword(accountId, password);
    // A password change invalidates every other signed-in session.
    await destroyAllSessions(accountId);

    const account = await getAccountById(accountId);
    const { token: sessionToken, expiresAt } = await createSession({
      accountId,
      tenantSlug: account.slug,
    });
    const res = NextResponse.json({ account: publicAccount(account) });
    return setSessionCookie(res, sessionToken, expiresAt);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
