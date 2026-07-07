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
  if (!state) {
    // No usable state means this install wasn't kicked off via our own
    // /api/oauth/start (most likely: someone clicked "Install" straight from
    // the GHL Marketplace listing page). We have no way to know which
    // tenant/app this belongs to, so there's nothing to exchange - just
    // point them back to the portal instead of throwing.
    console.error(
      `[APP-OAUTH-NO-STATE] code=${code ? "present" : "missing"} referer=${
        req.headers.get("referer") || "-"
      } ua=${req.headers.get("user-agent") || "-"}`
    );
    return NextResponse.redirect(`${origin}/api/oauth/connected?ok=0&reason=no_portal_state`);
  }
  if (!code) {
    console.error(`[APP-OAUTH-FAIL] app=${state.app} tenant=${state.tenant} missing code param`);
    return NextResponse.redirect(
      `${origin}/api/oauth/connected?ok=0&app=${state.app}&tenant=${state.tenant}&reason=missing_code`
    );
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
