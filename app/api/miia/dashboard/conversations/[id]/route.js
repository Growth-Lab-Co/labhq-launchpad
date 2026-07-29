import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { resolveLocationDataAuth, listMessages } from "@/lib/ghl";
import { getWidgetConversation } from "@/lib/widgetConversations";

// Read-only transcript fetch for the Conversations page - customer-session
// gated, same pattern as the other /api/miia/dashboard/* routes. Checks
// widget conversations first (a cheap local lookup, no GHL round trip) -
// job 1's unified Conversations page can pass either kind of id here.
export async function GET(req, { params }) {
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug");
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const widgetConvo = await getWidgetConversation(params.id);
  if (widgetConvo) {
    if (widgetConvo.tenant !== tenantSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Stored oldest-first; GHL's listMessages (and this route's other
    // branch below) returns newest-first, and the client always
    // .reverse()s back to oldest-first for display - matching that
    // convention here rather than the client's own storage order.
    return NextResponse.json({ messages: [...widgetConvo.messages].reverse() });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment?.locationId) return NextResponse.json({ messages: [] });

  try {
    const legacyCreds = ghlCredsFor(tenant);
    const auth = await resolveLocationDataAuth({ tenantSlug, locationId: deployment.locationId, legacyCreds });
    if (!auth.token) return NextResponse.json({ messages: [] });
    const messages = await listMessages({ token: auth.token, conversationId: params.id, limit: 50 });
    return NextResponse.json({ messages });
  } catch (e) {
    console.error(`[DASHBOARD-CONVO-FAIL] tenant=${tenantSlug} conversationId=${params.id}`, e.message);
    return NextResponse.json({ error: "Couldn't load this conversation right now." }, { status: 502 });
  }
}
