import { NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/adminAuth";
import { createOrReuseClaimLink, listClaimLinks } from "@/lib/claimLinks";
import { getTenant } from "@/lib/tenants";

function authorized(req) {
  return verifyAdminKey(req.headers.get("x-mc-key"));
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const links = await listClaimLinks();
  return NextResponse.json({ links });
}

export async function POST(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantSlug, planLabel } = await req.json().catch(() => ({}));

  const slug = String(tenantSlug || "").trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  const tenant = await getTenant(slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const link = await createOrReuseClaimLink({ tenantSlug: slug, planLabel });
  return NextResponse.json({ link });
}
