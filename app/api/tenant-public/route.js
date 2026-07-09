import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";

// Unauthenticated on purpose - same safe-fields shape as the publicTenant
// object app/[tenant]/page.jsx builds server-side, but reachable from a
// client component (the Mission Control gate) that needs tenant metadata
// before any auth has happened.
export async function GET(req) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const tenant = await getTenant(slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  return NextResponse.json({
    slug: tenant.slug,
    name: tenant.name,
    assistantName: tenant.assistantName,
    logoText: tenant.logoText,
    logoUrl: tenant.logoUrl,
    accent: tenant.accent,
    accentSoft: tenant.accentSoft,
    welcome: tenant.welcome,
  });
}
