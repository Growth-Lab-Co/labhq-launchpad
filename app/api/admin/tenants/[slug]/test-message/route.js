import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getTenant } from "@/lib/tenants";
import { generateReply } from "@/lib/bot";

// Ops utility: send one test message through a tenant's bot and see the
// reply, using its live guardrails (including healthcareMode) - no
// deployment record required, no GHL calls. Useful to sanity-check a
// tenant's guardrail behaviour right after signup/toggling healthcare mode,
// before (or without ever needing) a real deploy.
export async function POST(req, { params }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    if (auth.rateLimited) {
      return NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429, headers: { "retry-after": String(auth.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(params.slug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const { inboundText } = await req.json().catch(() => ({}));
  if (!inboundText) return NextResponse.json({ error: "Missing inboundText" }, { status: 400 });

  const { reply } = await generateReply({
    deployment: { tenant: params.slug, businessName: tenant.name, customValues: {} },
    messages: [],
    inboundText,
  });

  return NextResponse.json({ reply, healthcareMode: Boolean(tenant.healthcareMode) });
}
