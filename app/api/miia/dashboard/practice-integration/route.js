import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant, updateTenant } from "@/lib/tenants";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { getConnectionPublic, saveConnection } from "@/lib/integrations/credentials";
import { getProvider } from "@/lib/integrations/registry";
import { logActivity } from "@/lib/activity";
import { sendTransactionalEmail } from "@/lib/emailFailures";

const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const OPS_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

async function requireSession(req, tenantSlug) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  return session && session.tenantSlug === tenantSlug;
}

// GET: current connection status (never credentials) + which practice
// software this tenant said they use, so the dashboard knows which card to
// emphasise (lib/tenants.js's practiceSoftware, set at deploy time from the
// intake - see app/api/deploy/route.js).
export async function GET(req) {
  const tenantSlug = req.nextUrl.searchParams.get("tenantSlug");
  if (!(await requireSession(req, tenantSlug))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  const connection = await getConnectionPublic(tenantSlug);
  return NextResponse.json({ connection, practiceSoftware: tenant.practiceSoftware || null });
}

// POST: { tenantSlug, provider, apiKey } - validates live against the real
// provider before saving anything. Never saves invalid credentials, never
// echoes the key back.
export async function POST(req) {
  const { tenantSlug, provider: providerId, apiKey } = await req.json().catch(() => ({}));
  if (!(await requireSession(req, tenantSlug))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: "Unknown provider" }, { status: 400 });

  const result = await provider.adapter.validateCredentials({ apiKey });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await saveConnection(tenantSlug, {
    provider: providerId,
    credentials: { apiKey },
    status: "connected",
    meta: result.meta || null,
  });

  return NextResponse.json({ ok: true, meta: result.meta || null });
}

// PATCH: { tenantSlug, interest: "halaxy" } - "register interest" for a
// not-yet-available provider. No credentials involved - just logs an
// activity entry and emails ops, same pattern as the Leadsie webhook's ops
// alert.
export async function PATCH(req) {
  const { tenantSlug, interest } = await req.json().catch(() => ({}));
  if (!(await requireSession(req, tenantSlug))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  await logActivity({
    tenant: tenantSlug,
    businessName: tenant.name,
    type: "attention",
    text: `Registered interest in the ${interest || "unknown"} practice-software integration.`,
  });
  await sendTransactionalEmail({
    context: "practice-integration-interest",
    to: OPS_EMAIL,
    subject: `${tenant.name} wants ${interest || "a"} integration`,
    text: `${tenant.name} (${tenantSlug}) clicked "register interest" for the ${interest || "unknown"} practice-software integration on their dashboard.`,
    from: MIIA_FROM,
    tenantSlug,
  }).catch((e) => console.error(`[PRACTICE-INTEGRATION] interest email failed for ${tenantSlug}:`, e.message));

  return NextResponse.json({ ok: true });
}
