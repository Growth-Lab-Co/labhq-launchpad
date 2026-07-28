import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant, updateTenant, SEED_TENANTS } from "@/lib/tenants";

// Manual correction/backfill for practiceSoftware (see app/api/deploy/route.js's
// deploy action, which normally sets this from the intake) - same pattern
// as the product-type and healthcare-mode admin routes.
export async function POST(req, { params }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    if (auth.rateLimited) {
      return NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429, headers: { "retry-after": String(auth.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (SEED_TENANTS[params.slug]) {
    return NextResponse.json({ error: "Seed tenants can't be modified here" }, { status: 400 });
  }

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const { practiceSoftware } = await req.json().catch(() => ({}));
  if (!["cliniko", "halaxy", "other", "none"].includes(practiceSoftware)) {
    return NextResponse.json({ error: "practiceSoftware must be cliniko, halaxy, other or none" }, { status: 400 });
  }

  const updated = await updateTenant(params.slug, { practiceSoftware });
  return NextResponse.json({ tenant: updated });
}
