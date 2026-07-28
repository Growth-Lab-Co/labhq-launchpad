import { NextResponse } from "next/server";
import { miiaStripeConfigured, createMiiaCheckoutSession } from "@/lib/miiaStripe";
import { SITE_URL } from "@/components/miia/site";

const VALID_PLANS = ["chat", "everywhere", "complete"];

// Always uses meetmiia.com URLs (SITE_URL), regardless of which attached
// domain the request itself arrived on.
export async function POST(req) {
  if (!miiaStripeConfigured()) {
    return NextResponse.json({ error: "Checkout isn't set up yet." }, { status: 503 });
  }

  const { plan, billingPeriod, vertical } = await req.json().catch(() => ({}));
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
  }

  try {
    const session = await createMiiaCheckoutSession({
      plan,
      billingPeriod: billingPeriod === "yearly" ? "yearly" : "monthly",
      vertical: typeof vertical === "string" ? vertical.slice(0, 60) : "",
      successUrl: `${SITE_URL}/get-started/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${SITE_URL}/pricing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[miia-checkout] session creation failed:", e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't start checkout. Try again." }, { status: 500 });
  }
}
