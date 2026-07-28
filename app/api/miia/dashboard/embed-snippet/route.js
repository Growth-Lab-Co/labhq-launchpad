import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { websiteChatEmbedSnippet } from "@/lib/channelWiring";

// Generates the website chat widget's embed snippet rather than fetching it
// from GHL - the real chat-widget-config endpoint is gated behind the
// chat-widget.readonly scope, which the location app doesn't request (see
// lib/channelWiring.js's header comment), and adding OAuth scopes is out of
// bounds here. HighLevel's own docs confirm the snippet only ever needs the
// location's ID (verified 2026-07-28) - nothing else to fetch, so this never
// has to return an empty card once a tenant is deployed.
export async function GET(req) {
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug");
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment?.locationId) return NextResponse.json({ embed: null });

  const snippet = websiteChatEmbedSnippet({ locationId: deployment.locationId, accent: tenant.accent });
  return NextResponse.json({ embed: { locationId: deployment.locationId, snippet } });
}
