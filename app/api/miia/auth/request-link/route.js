import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getSignupByTenantSlug } from "@/lib/miiaSignups";
import { createMagicLink } from "@/lib/miiaCustomerAuth";
import { buildMagicLinkEmail } from "@/lib/miiaEmails";
import { sendTransactionalEmail, logEmailFailure } from "@/lib/emailFailures";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { SITE_URL } from "@/components/miia/site";

const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Always returns the same generic response whether or not the email
// actually matches this tenant's signup - avoids confirming account
// existence to an unauthenticated caller. Scoped to one tenantSlug (not a
// global email lookup) so this can't be used to enumerate which businesses
// an email address owns.
export async function POST(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({
    route: "miia-request-link",
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

  const { tenantSlug, email } = await req.json().catch(() => ({}));
  const generic = { ok: true, message: "If that email is on this account, a sign-in link is on its way." };

  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!tenantSlug || !cleanEmail) return NextResponse.json(generic);

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json(generic);

  const signup = await getSignupByTenantSlug(tenantSlug);
  if (!signup || signup.email.toLowerCase() !== cleanEmail) return NextResponse.json(generic);

  // Wrapped end to end: a throw anywhere here must still return the same
  // generic response (never a 500 that tips off a caller probing emails),
  // and must never silently vanish either - see lib/emailFailures.js and
  // the 2026-07-28 "welcome email never sent" incident this pattern backs.
  try {
    const token = await createMagicLink({ tenantSlug });
    const link = `${SITE_URL}/api/miia/auth/verify?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = buildMagicLinkEmail({
      firstName: (signup.contactName || "").trim().split(/\s+/)[0] || null,
      link,
    });
    await sendTransactionalEmail({
      context: "magic-link-request",
      to: signup.email,
      subject,
      html,
      text,
      from: MIIA_FROM,
      signupId: signup.id,
      tenantSlug,
    });
  } catch (e) {
    console.error(`[MIIA-AUTH-FAIL] tenant=${tenantSlug} step=crashed`, e.stack || e.message);
    await logEmailFailure({
      context: "magic-link-request-crashed",
      to: signup.email,
      error: e.stack || e.message,
      signupId: signup.id,
      tenantSlug,
    }).catch(() => {});
  }

  return NextResponse.json(generic);
}
