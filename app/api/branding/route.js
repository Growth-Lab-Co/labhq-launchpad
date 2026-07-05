import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getBranding, setBrandingUrls } from "@/lib/branding";
import { verifyPassword } from "@/lib/mcAuth";

// Accepts a pasted absolute http(s) URL, or one of our own uploaded-asset
// paths (e.g. "/api/branding/asset?...") which isn't absolute.
function isValidImageUrl(value) {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Unauthenticated on purpose - branding URLs aren't sensitive, and every
// page under a tenant needs to read them (including the public intake page).
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

export async function PATCH(req) {
  try {
    const { tenant, faviconUrl, logoUrl } = await req.json();
    if (!tenant || !getTenant(tenant)) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

    const key = req.headers.get("x-mc-key");
    if (!(await verifyPassword(tenant, key))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (faviconUrl && !isValidImageUrl(faviconUrl)) {
      return NextResponse.json({ error: "Favicon must be a valid image URL" }, { status: 400 });
    }
    if (logoUrl && !isValidImageUrl(logoUrl)) {
      return NextResponse.json({ error: "Logo must be a valid image URL" }, { status: 400 });
    }

    const branding = await setBrandingUrls(tenant, { faviconUrl, logoUrl });
    return NextResponse.json(branding);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
