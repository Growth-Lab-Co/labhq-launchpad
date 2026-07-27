import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant, resetTenantDeploy } from "@/lib/tenants";

// Escape hatch for the one-deploy-per-tenant lock (lib/tenants.js
// markTenantDeployed) - a real customer who needs their setup redone has no
// self-serve way to do it, so support clears the lock here and hands them
// a fresh link. Only meaningful for product:"miia" tenants; the lock is
// never set for anything else, so this is a harmless no-op there.
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

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const updated = await resetTenantDeploy(params.slug);
  return NextResponse.json({ tenant: updated });
}
