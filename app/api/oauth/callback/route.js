import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { exchangeCode, getAppRedirectUri, storeTokenResponse, verifyState } from "@/lib/ghlOAuth";

// GET /api/oauth/callback - shared by both marketplace apps. The signed
// `state` param (set in /api/oauth/start) carries which app + tenant this
// belongs to, since GHL doesn't otherwise tell us which app authorized.
export async function GET(req) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    console.error(`[APP-OAUTH-FAIL] provider returned error=${oauthError}`);
    return NextResponse.redirect(
      `${origin}/api/oauth/connected?ok=0&reason=${encodeURIComponent(oauthError)}`
    );
  }

  const state = verifyState(searchParams.get("state"));
  if (!code || !state) {
    console.error("[APP-OAUTH-FAIL] missing or invalid code/state");
    return NextResponse.redirect(`${origin}/api/oauth/connected?ok=0&reason=invalid_state`);
  }

  const { app, tenant } = state;
  try {
    if (!getTenant(tenant)) throw new Error(`Unknown tenant in state: ${tenant}`);
    const redirectUri = getAppRedirectUri(app);
    const tokenResponse = await exchangeCode({ app, code, redirectUri });
    await storeTokenResponse({ tenant, app, tokenResponse });

    const qs = new URLSearchParams({ ok: "1", app, tenant });
    if (tokenResponse.locationId) qs.set("locationId", tokenResponse.locationId);
    return NextResponse.redirect(`${origin}/api/oauth/connected?${qs.toString()}`);
  } catch (e) {
    console.error(
      `[APP-OAUTH-FAIL] tenant=${tenant} app=${app} status=${e.status ?? "-"}`,
      e.body ?? e.message
    );
    return NextResponse.redirect(
      `${origin}/api/oauth/connected?ok=0&app=${app}&tenant=${tenant}&reason=exchange_failed`
    );
  }
}
