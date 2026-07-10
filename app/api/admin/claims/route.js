import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { createOrReuseClaimLink, listClaimLinks } from "@/lib/claimLinks";
import { getTenant } from "@/lib/tenants";

function denyResponse({ rateLimited, retryAfterSeconds }) {
  if (rateLimited) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
    );
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(req) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) return denyResponse(auth);
  const links = await listClaimLinks();
  return NextResponse.json({ links });
}

export async function POST(req) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) return denyResponse(auth);
  const { tenantSlug, planLabel } = await req.json().catch(() => ({}));

  const slug = String(tenantSlug || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  const tenant = await getTenant(slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const link = await createOrReuseClaimLink({ tenantSlug: slug, planLabel });
  return NextResponse.json({ link });
}
