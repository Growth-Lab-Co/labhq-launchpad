import { NextResponse } from "next/server";
import { createAccount, publicAccount } from "@/lib/accounts";
import { createSession, setSessionCookie, cookieDomainForRequest } from "@/lib/portalSession";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export async function POST(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({
    route: "signup",
    ip,
    max: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many signup attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
    );
  }

  try {
    const { agencyName, slug, contactEmail, password, acceptTerms } = await req.json();
    if (!acceptTerms) {
      return NextResponse.json({ error: "You must agree to the licence terms" }, { status: 400 });
    }

    const account = await createAccount({
      agencyName,
      slug,
      contactEmail,
      password,
      acceptedTermsAt: new Date().toISOString(),
    });

    const { token, expiresAt } = await createSession({ accountId: account.id, tenantSlug: account.slug });
    const res = NextResponse.json({ account: publicAccount(account) });
    return setSessionCookie(res, token, expiresAt, cookieDomainForRequest(req));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
