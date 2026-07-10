import { NextResponse } from "next/server";
import { verifyAccountPassword, publicAccount } from "@/lib/accounts";
import { createSession, setSessionCookie, cookieDomainForRequest } from "@/lib/portalSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function POST(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({
    route: "login",
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
    const { email, password } = await req.json();
    const account = await verifyAccountPassword(email, password);
    if (!account) {
      return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
    }

    const { token, expiresAt } = await createSession({ accountId: account.id, tenantSlug: account.slug });
    const res = NextResponse.json({ account: publicAccount(account) });
    return setSessionCookie(res, token, expiresAt, cookieDomainForRequest(req));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
