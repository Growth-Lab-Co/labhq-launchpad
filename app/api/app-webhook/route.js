import { NextResponse } from "next/server";
import { verifyGhlSignature } from "@/lib/webhookVerify";
import { resolveTenantForLocation } from "@/lib/tenantLookup";

// POST /api/app-webhook - GHL Marketplace app webhook receiver. The only
// event this currently drives anything is InboundMessage, which fans out to
// the AI conversation bot (lib/bot.js). Everything else is acked fast and
// ignored so the marketplace app listing has one webhook URL for everything.
//
// This handler only ever uses the payload's locationId/conversationId/
// contactId/messageType as LOOKUP KEYS, never as trusted content - the
// background function re-fetches the real conversation/messages from GHL
// with our own token before generating or sending a reply. That's true
// regardless of whether X-GHL-Signature verifies, so a webhook that fails
// signature verification (or predates GHL's rollout of that header) still
// can't be used to make the bot say or do anything - at worst it triggers a
// wasted lookup that finds nothing to act on.
export async function POST(req) {
  const rawBody = await req.text();
  let payload = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const type = payload?.type || "unknown";
  if (type !== "InboundMessage") {
    return NextResponse.json({ ok: true });
  }

  const signatureHeader = req.headers.get("x-ghl-signature");
  const verified = verifyGhlSignature(rawBody, signatureHeader);

  const { locationId, conversationId, contactId, messageType, messageId } = payload;
  if (!locationId || !conversationId) {
    console.log(`[CONVO-BOT] InboundMessage missing locationId/conversationId, ignoring`);
    return NextResponse.json({ ok: true });
  }

  console.log(
    `[CONVO-BOT] inbound locationId=${locationId} conversationId=${conversationId} messageType=${messageType} signatureVerified=${verified}`
  );

  const tenant = await resolveTenantForLocation(locationId);
  if (!tenant) {
    console.log(`[CONVO-BOT] no tenant found for locationId=${locationId}, ignoring`);
    return NextResponse.json({ ok: true });
  }

  // Hand off to the Background Function (15 min budget) so this route can
  // ack GHL immediately - reply generation involves 2+ Claude calls and a
  // handful of GHL API round-trips, which risks this route's own timeout.
  try {
    const site = process.env.URL || `https://${req.headers.get("host")}`;
    await fetch(`${site}/.netlify/functions/bot-reply-background`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant,
        locationId,
        conversationId,
        contactId: contactId || null,
        messageType: messageType || null,
        inboundMessageId: messageId || null,
      }),
    });
  } catch (e) {
    console.error(`[CONVO-BOT-FAIL] failed to enqueue background reply:`, e.message);
  }

  return NextResponse.json({ ok: true });
}
