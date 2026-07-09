import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { appConfigured, buildAuthorizeUrl } from "@/lib/ghlOAuth";

// GET /api/oauth/start?app=agency|location&tenant=<slug>
// Redirects to the correct marketplace app's GHL authorize URL. Route name
// deliberately avoids "ghl" - GHL rejects marketplace listing/redirect URLs
// containing their own name.
export async function GET(req) {
  const { searchParams } = req.nextUrl;
  const app = searchParams.get("app");
  const tenant = searchParams.get("tenant");

  if (app !== "agency" && app !== "location") {
    return NextResponse.json({ error: "app must be 'agency' or 'location'" }, { status: 400 });
  }
  if (!tenant || !(await getTenant(tenant))) {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }
  if (!appConfigured(app)) {
    return NextResponse.json({ error: `${app} app is not configured yet` }, { status: 503 });
  }

  try {
    const { authorizeUrl } = buildAuthorizeUrl({ app, tenant });
    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
