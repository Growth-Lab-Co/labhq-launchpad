import { NextResponse } from "next/server";
import { createTenant } from "@/lib/tenants";

// TEMPORARY - mints a bare, undeployed Miia tenant directly (no Stripe
// checkout involved at all), so the intake/generate/deploy flow can be
// verified end to end without a real live charge now that Stripe is in
// live mode. Same throwaway-testing pattern as app/api/test-deploy/route.js.
// Remove once tonight's launch-blocker verification is done.
//
// POST /api/admin/test-miia-tenant
// Header: x-mc-key: <MC_PASSWORD>
// Body: { "slug": "verify-abc123", "name": "Verify Test Abc123" }
export async function POST(req) {
  const key = req.headers.get("x-mc-key");
  if (!process.env.MC_PASSWORD || key !== process.env.MC_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { slug, name } = await req.json().catch(() => ({}));
  if (!slug || !name) return NextResponse.json({ error: "slug and name are required" }, { status: 400 });

  const tenant = await createTenant({
    slug,
    name,
    ownerAccountId: null,
    envPrefix: null,
    assistantName: "Miia",
    product: "miia",
    welcome: "Miia is setting up your front desk",
    accent: "#A070F8",
    accentSoft: "#9878F0",
    healthcareMode: false,
    healthcareModeSource: null,
    productType: "miia",
    plan: "chat",
  });
  if (!tenant) return NextResponse.json({ error: "slug already taken" }, { status: 409 });

  return NextResponse.json({ ok: true, tenant });
}
