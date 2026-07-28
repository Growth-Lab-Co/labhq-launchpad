import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { getSignupByTenantSlug } from "@/lib/miiaSignups";
import { createMiiaPortalSession } from "@/lib/miiaStripe";
import { SITE_URL } from "@/components/miia/site";

export async function POST(req) {
  const { tenantSlug } = await req.json().catch(() => ({}));
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signup = await getSignupByTenantSlug(tenantSlug);
  if (!signup?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found for this business yet." }, { status: 404 });
  }

  try {
    const portalSession = await createMiiaPortalSession({
      customerId: signup.stripeCustomerId,
      returnUrl: `${SITE_URL}/${tenantSlug}/billing`,
    });
    return NextResponse.json({ url: portalSession.url });
  } catch (e) {
    console.error(`[BILLING-PORTAL-FAIL] tenant=${tenantSlug}`, e.status ?? "-", e.body ?? e.message);
    return NextResponse.json({ error: "Couldn't open billing right now. Try again shortly." }, { status: 502 });
  }
}
