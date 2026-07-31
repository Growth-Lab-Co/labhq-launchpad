import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { getSignupByTenantSlug, updateSignup } from "@/lib/miiaSignups";
import { getTenant, updateTenant } from "@/lib/tenants";
import { updateMiiaSubscriptionPrice } from "@/lib/miiaStripe";
import { logActivity } from "@/lib/activity";

// Self-serve Chat -> Everywhere upgrade (job 4, 2026-07-31) - the "Upgrade"
// label beside SMS/Facebook/Instagram used to be a dead pill with no click
// handler at all. Only this one transition is supported (the only one
// asked for, and the only one the dashboard currently offers a button
// for) - a generic multi-plan upgrade matrix wasn't built, deliberately,
// since nothing on the dashboard needs one yet.
//
// Prices the SIGNUP's own `founding` flag, not the global MIIA_FOUNDING_MODE
// toggle (see lib/miiaStripe.js resolvePriceId, which reads the global one) -
// a customer who signed up during the founding window keeps their founding
// rate on this upgrade even if the window has since closed for new signups.
export async function POST(req) {
  const { tenantSlug } = await req.json().catch(() => ({}));
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signup = await getSignupByTenantSlug(tenantSlug);
  if (!signup?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription found for this business." }, { status: 404 });
  }
  if (signup.plan !== "chat") {
    return NextResponse.json({ error: "This upgrade is only available from Miia Chat." }, { status: 400 });
  }

  const priceId = signup.founding
    ? process.env.MIIA_STRIPE_PRICE_EVERYWHERE_FOUNDING
    : process.env.MIIA_STRIPE_PRICE_EVERYWHERE_MONTHLY;
  if (!priceId) {
    return NextResponse.json({ error: "Everywhere pricing isn't configured yet - contact us to upgrade." }, { status: 500 });
  }

  try {
    await updateMiiaSubscriptionPrice(signup.stripeSubscriptionId, priceId);
  } catch (e) {
    console.error(`[UPGRADE-PLAN-FAIL] tenant=${tenantSlug}`, e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't process the upgrade - try again or contact us." }, { status: 502 });
  }

  // Stripe's own state is now the source of truth; sync ours to match
  // immediately rather than waiting on the subscription.updated webhook
  // (which is only a backstop - see app/api/miia/webhook/route.js) so the
  // channels unlock the moment this request completes.
  await updateSignup(signup.id, { plan: "everywhere" });
  await updateTenant(tenantSlug, { plan: "everywhere" });

  const tenant = await getTenant(tenantSlug).catch(() => null);
  await logActivity({
    tenant: tenantSlug,
    businessName: tenant?.name,
    type: "deployment",
    text: "Upgraded from Miia Chat to Miia Everywhere",
  }).catch(() => {});

  return NextResponse.json({ ok: true, plan: "everywhere" });
}
