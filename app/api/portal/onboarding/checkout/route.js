import { NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/portalSession";
import { stripeConfigured, createCheckoutSession } from "@/lib/stripe";

// Stripe path for the Activate step - stays inert (503) until
// STRIPE_SECRET_KEY + STRIPE_PRICE_ID_FOUNDING are set. Invite codes are the
// only live activation path; this exists so wiring real keys later needs no
// code change.
export async function POST(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Card payment isn't set up yet - use an invite code instead." }, { status: 503 });
  }

  try {
    const origin = req.nextUrl.origin;
    const checkoutSession = await createCheckoutSession({
      accountId: session.accountId,
      tenantSlug: session.tenantSlug,
      successUrl: `${origin}/portal/onboarding/connect`,
      cancelUrl: `${origin}/portal/onboarding/activate`,
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (e) {
    console.error("[stripe] checkout session failed:", e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 500 });
  }
}
