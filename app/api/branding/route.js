import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getBranding, setBrandingFields } from "@/lib/branding";
import { verifyPassword } from "@/lib/mcAuth";

// Unauthenticated on purpose - branding URLs aren't sensitive, and every
// page under a tenant needs to read them (including the public intake page).
// Setting branding happens only via upload - see app/api/branding/asset/route.js.
export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!tenant || !getTenant(tenant)) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  try {
    const branding = await getBranding(tenant);
    return NextResponse.json(branding);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Saves accent colour + welcome message from Mission Control's Branding page.
export async function PATCH(req) {
  try {
    const { tenant, accent, welcomeMessage } = await req.json();
    if (!tenant || !getTenant(tenant)) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
    const key = req.headers.get("x-mc-key");
    if (!(await verifyPassword(tenant, key))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const branding = await setBrandingFields(tenant, { accent, welcomeMessage });
    return NextResponse.json(branding);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
