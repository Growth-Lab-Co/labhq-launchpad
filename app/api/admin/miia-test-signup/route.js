import { NextResponse } from "next/server";
import { findOrCreateSignup } from "@/lib/miiaSignups";
import { provisionTenantForSignup } from "@/lib/miiaProvisioning";

// TEMPORARY, test-only - mints a real signup record + tenant using the
// exact same code path a paid checkout uses (findOrCreateSignup +
// provisionTenantForSignup), with no Stripe interaction at all. Built
// 2026-07-31 to verify the field-splitting source fix without a real
// charge - remove once that verification is done.
export async function POST(req) {
  const key = req.headers.get("x-mc-key");
  if (!process.env.MC_PASSWORD || key !== process.env.MC_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { businessName, contactName, email, phone, plan } = await req.json().catch(() => ({}));
  if (!businessName || !contactName) {
    return NextResponse.json({ error: "businessName and contactName required" }, { status: 400 });
  }

  const signup = await findOrCreateSignup({
    stripeCheckoutSessionId: `test_nostripe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    businessName,
    contactName,
    email: email || "",
    phone: phone || "",
    plan: plan || "chat",
    billingPeriod: "monthly",
    founding: false,
    whiteGlove: false,
    vertical: "",
  });

  const provisioned = await provisionTenantForSignup(signup);
  return NextResponse.json({
    signupId: provisioned.id,
    tenantSlug: provisioned.tenantSlug,
    provisioningStatus: provisioned.provisioningStatus,
    provisioningError: provisioned.provisioningError,
  });
}
