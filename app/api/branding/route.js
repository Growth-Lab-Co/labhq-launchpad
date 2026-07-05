import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { getBranding, setFaviconUrl } from "@/lib/branding";
import { verifyPassword } from "@/lib/mcAuth";

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Unauthenticated on purpose - a favicon URL isn't sensitive, and every page
// under a tenant needs to read it (including the public-facing intake page).
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
    const { tenant, faviconUrl } = await req.json();
    if (!tenant || !getTenant(tenant)) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

    const key = req.headers.get("x-mc-key");
    if (!(await verifyPassword(tenant, key))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (faviconUrl && !isValidHttpUrl(faviconUrl)) {
      return NextResponse.json({ error: "Favicon must be a valid http(s) URL" }, { status: 400 });
    }

    await setFaviconUrl(tenant, faviconUrl || null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
