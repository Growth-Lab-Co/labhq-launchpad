import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant } from "@/lib/tenants";
import { listDeployments, patchDeploymentCustomValues } from "@/lib/deployments";
import { getSession, SESSION_COOKIE } from "@/lib/miiaCustomerAuth";

// Customer-editable business info - job 3, 2026-07-31 ("what if pricing or
// hours change, does the customer have to email Bec every time"). Deliberately
// a narrower whitelist than the full CUSTOM_VALUE_KEYS set: fields a business
// owner would obviously expect to keep current themselves (pricing, services,
// hours, contact details) are here; compliance-sensitive fields
// (mia_guardrails, sms_compliance_footer, privacy_policy_snippet) and
// greeting_line (derived from business_name, would silently drift out of
// sync if edited separately) are deliberately left out of self-serve editing
// for now - see components/dashboard/SettingsPageClient.jsx's own comment.
// lib/bot.js reads customValues fresh on every reply, so a save here takes
// effect immediately, no redeploy needed - same mechanism as the existing
// booking-link editor (app/api/miia/dashboard/booking-link/route.js).
const EDITABLE_FIELDS = [
  "business_name",
  "pricing_summary",
  "services_summary",
  "service_area",
  "opening_hours",
  "booking_rules",
  "tone_style",
  "escalation_name",
  "escalation_contact",
  "website_url",
  "faq_block",
];
const MAX_FIELD_LENGTH = 4000;

export async function POST(req) {
  const { tenantSlug, patch } = await req.json().catch(() => ({}));
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant || tenant.product !== "miia") {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment) return NextResponse.json({ error: "Not deployed yet" }, { status: 400 });

  if (!patch || typeof patch !== "object") {
    return NextResponse.json({ error: "Missing patch" }, { status: 400 });
  }

  const safePatch = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!EDITABLE_FIELDS.includes(key)) {
      return NextResponse.json({ error: `"${key}" isn't editable here` }, { status: 400 });
    }
    safePatch[key] = typeof value === "string" ? value.trim().slice(0, MAX_FIELD_LENGTH) : "";
  }

  const updated = await patchDeploymentCustomValues(deployment.id, tenantSlug, safePatch);
  if (!updated) return NextResponse.json({ error: "Couldn't save that - try again" }, { status: 500 });

  return NextResponse.json({ customValues: updated.customValues });
}
