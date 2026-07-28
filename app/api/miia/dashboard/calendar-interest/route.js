import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenants";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";
import { logActivity } from "@/lib/activity";
import { sendTransactionalEmail } from "@/lib/emailFailures";

const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const OPS_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

// Files an ops task instead of a real connect flow - no Google OAuth app
// exists anywhere in this codebase (see MORNING-REPORT.md for the exact
// blocker: needs a Google Cloud project, OAuth consent screen, and a
// client ID/secret set as env vars, none of which exist yet).
export async function POST(req) {
  const { tenantSlug } = await req.json().catch(() => ({}));
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });

  await logActivity({
    tenant: tenantSlug,
    businessName: tenant.name,
    type: "attention",
    text: "Asked for Google Calendar to be connected - needs manual setup.",
  });
  await sendTransactionalEmail({
    context: "calendar-connect-request",
    to: OPS_EMAIL,
    subject: `${tenant.name} wants their calendar connected`,
    text: `${tenant.name} (${tenantSlug}) clicked "Connect your calendar" on their dashboard. Google Calendar OAuth isn't wired up yet - set this up with them directly.`,
    from: MIIA_FROM,
    tenantSlug,
  }).catch((e) => console.error(`[CALENDAR-INTEREST] ops alert email failed for ${tenantSlug}:`, e.message));

  return NextResponse.json({ ok: true });
}
