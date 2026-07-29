import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant, ensureWidgetKey } from "@/lib/tenants";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { miiaWidgetEmbedSnippet } from "@/lib/channelWiring";

// Extended for job 1 (2026-07-29 "simplification build"), not rebuilt: this
// used to generate a GHL chat-widget snippet keyed by locationId (see
// lib/channelWiring.js's websiteChatEmbedSnippet, left in place - existing
// customers who already embedded that one keep working untouched). The
// Channels card now hands out the in-house Miia widget instead, keyed by
// the tenant's own public widgetKey - no GHL sub-account/locationId
// dependency at all, so it's available immediately, before any GHL
// provisioning has finished (see job 2a's instant Chat tier).
export async function GET(req) {
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug");
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const withKey = await ensureWidgetKey(tenant);
  if (!withKey?.widgetKey) return NextResponse.json({ embed: null });

  const snippet = miiaWidgetEmbedSnippet({ widgetKey: withKey.widgetKey });
  return NextResponse.json({ embed: { widgetKey: withKey.widgetKey, snippet } });
}
