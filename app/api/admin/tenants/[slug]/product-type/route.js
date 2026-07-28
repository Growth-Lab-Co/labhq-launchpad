import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant, updateTenant, SEED_TENANTS } from "@/lib/tenants";

// Manual correction for the productType flag (see lib/tenants.js
// tenantProductType()) - every dashboard-vs-Mission-Control routing
// decision keys off this, so an operator needs a way to fix a
// misclassified tenant without a redeploy. Also how the one-time
// 2026-07-28 backfill was run for existing dynamic tenants (SEED tenants
// carry this as a code literal instead - see lib/tenants.js).
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
    return NextResponse.json({ error: "Seed tenants can't be modified here - edit lib/tenants.js" }, { status: 400 });
  }

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const { productType } = await req.json().catch(() => ({}));
  if (productType !== "miia" && productType !== "agency") {
    return NextResponse.json({ error: "productType must be 'miia' or 'agency'" }, { status: 400 });
  }

  const updated = await updateTenant(params.slug, { productType });
  return NextResponse.json({ tenant: updated });
}
