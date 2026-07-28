import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenants";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { generateReply } from "@/lib/bot";

// Customer-facing "try her yourself" test chat - the dashboard equivalent of
// the admin test-message route, gated by the customer's own session cookie
// instead of the operator key. No deployment record needed, no GHL calls.
export async function POST(req) {
  const { tenantSlug, inboundText } = await req.json().catch(() => ({}));
  if (!tenantSlug || !inboundText) {
    return NextResponse.json({ error: "Missing tenantSlug or inboundText" }, { status: 400 });
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const reply = await generateReply({
    deployment: { tenant: tenantSlug, businessName: tenant.name, customValues: {} },
    messages: [],
    inboundText,
  });

  return NextResponse.json({ reply });
}
