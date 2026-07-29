import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import { saveLeadsieConnection } from "@/lib/leadsieConnections";
import { logActivity } from "@/lib/activity";
import { sendTransactionalEmail } from "@/lib/emailFailures";

// Leadsie's documented webhook payload (help.leadsie.com/article/127-webhooks,
// /article/43-webhooks - read 2026-07-28, not guessed):
//   {
//     user: string,               // the customUserId we append to the embed
//                                  // URL as ?customUserId=<tenantSlug> - see
//                                  // components/dashboard/ChannelsPageClient.jsx
//     accessLevel: "admin" | "view",
//     requestName: string,
//     requestUrl: string,
//     status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED",
//     clientName: string,
//     clientSummaryUrl: string,
//     apiVersion: 2,
//     connectionAssets: [{ id, name, type, connectionStatus,
//       wasInitialGrantSuccessful, wasAlreadyConnected, isSuccess, time }],
//   }
// Fires once, after the client completes a request (successful authorisation).
//
// Verification: Leadsie's docs do not document any signature header or
// shared secret for verifying a webhook call is really from them - this is
// an honest gap, not an oversight here. As a mitigation, if
// LEADSIE_WEBHOOK_SECRET is set, this route requires it as a `?secret=`
// query param on the webhook URL you configure in Leadsie's dashboard
// (Settings -> Webhooks & API). Leave it unset to accept unverified, which
// is what happens today.
const MIIA_FROM = process.env.MIIA_RESEND_FROM_EMAIL || "Miia <hello@growthlabco.com.au>";
const OPS_EMAIL = process.env.MIIA_OPS_ALERT_EMAIL || "hello@growthlabco.com.au";

function isSocialAsset(type) {
  const t = (type || "").toLowerCase();
  return t.includes("page") || t.includes("instagram") || t.includes("facebook");
}

export async function POST(req) {
  const expectedSecret = process.env.LEADSIE_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = req.nextUrl.searchParams.get("secret");
    if (provided !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    // Job 4 (2026-07-29): stays honest in the logs, not just in the code
    // comment above - every call is accepted unverified until
    // LEADSIE_WEBHOOK_SECRET is set and registered with Leadsie as
    // ?secret=... on the webhook URL.
    console.warn("[LEADSIE-WEBHOOK] LEADSIE_WEBHOOK_SECRET is not set - accepting this call unverified.");
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const tenantSlug = body.user;
  if (!tenantSlug) {
    // Nothing to correlate this to - log and ack rather than 4xx (Leadsie
    // will retry a failing status code; a malformed/legacy call without
    // customUserId isn't something a retry fixes).
    console.error("[LEADSIE-WEBHOOK] payload had no `user` (customUserId) - can't map to a tenant", body);
    return NextResponse.json({ ok: true, warning: "no customUserId on payload" });
  }

  const tenant = await getTenant(tenantSlug);
  if (!tenant) {
    console.error(`[LEADSIE-WEBHOOK] unknown tenant slug in customUserId: ${tenantSlug}`);
    return NextResponse.json({ ok: true, warning: "unknown tenant" });
  }

  const status = body.status === "SUCCESS" ? "received" : body.status === "PARTIAL_SUCCESS" ? "partial" : "failed";
  const assets = Array.isArray(body.connectionAssets) ? body.connectionAssets : [];
  const socialAssets = assets.filter((a) => isSocialAsset(a?.type));

  await saveLeadsieConnection(tenantSlug, {
    status,
    assets,
    clientName: body.clientName,
    clientSummaryUrl: body.clientSummaryUrl,
    raw: body,
  });

  if (status !== "failed") {
    await logActivity({
      tenant: tenantSlug,
      businessName: tenant.name,
      type: "attention",
      text: "Facebook/Instagram access received via Leadsie - needs GHL wiring to go live.",
    });

    const assetLines = socialAssets.length
      ? socialAssets.map((a) => `- ${a.type}: ${a.name} (${a.connectionStatus || "connected"})`).join("\n")
      : "(no Facebook/Instagram assets in this payload - check the full connection list)";

    await sendTransactionalEmail({
      context: "leadsie-connection-received",
      to: OPS_EMAIL,
      subject: `Leadsie: ${tenant.name} granted access - needs GHL wiring`,
      text: `${tenant.name} (${tenantSlug}) just granted access via Leadsie.\n\nStatus: ${body.status}\n\n${assetLines}\n\nFull summary: ${body.clientSummaryUrl || "(not provided)"}\n\nNext: wire this into the location's GHL Facebook/Instagram integration (Settings -> Integrations -> Connect under Facebook and Instagram) per DEPLOY.md's Channel wiring section, then flip the bot's fb/ig channel toggles on.`,
      from: MIIA_FROM,
      tenantSlug,
    }).catch((e) => console.error(`[LEADSIE-WEBHOOK] ops alert email failed for ${tenantSlug}:`, e.message));
  }

  return NextResponse.json({ ok: true });
}
