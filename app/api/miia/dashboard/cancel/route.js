import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { getSignupByTenantSlug } from "@/lib/miiaSignups";
import { cancelMiiaSubscription } from "@/lib/miiaStripe";

// Cancels at the end of the current billing period - see
// lib/miiaStripe.js cancelMiiaSubscription for why not immediately.
export async function POST(req) {
  const { tenantSlug } = await req.json().catch(() => ({}));
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signup = await getSignupByTenantSlug(tenantSlug);
  if (!signup?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No subscription found for this business yet." }, { status: 404 });
  }

  try {
    await cancelMiiaSubscription(signup.stripeSubscriptionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[CANCEL-FAIL] tenant=${tenantSlug}`, e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't cancel right now. Try again or reach out to us." }, { status: 502 });
  }
}
