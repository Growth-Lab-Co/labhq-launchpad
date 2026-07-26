// Verifies GHL Marketplace app webhooks using the current X-GHL-Signature
// header (Ed25519, per https://marketplace.gohighlevel.com/docs/webhook/
// WebhookIntegrationGuide). The key below is GHL's own published PUBLIC key
// for this - not a secret, safe to commit, same as any other well-known
// verification key.
//
// GHL's legacy X-Wh-Signature header (RSA-SHA256) is not verified here - the
// full legacy public key wasn't available to hardcode with confidence, and
// GHL has deprecated that header anyway. When X-GHL-Signature is missing or
// doesn't verify, app/api/app-webhook/route.js does NOT treat the payload as
// trusted: it only uses the webhook's locationId/conversationId as a lookup
// key and re-fetches the actual conversation/message content from GHL using
// our own OAuth token before generating or sending anything.

import crypto from "crypto";

const GHL_SIGNATURE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export function verifyGhlSignature(rawBody, signatureHeader) {
  if (!signatureHeader || signatureHeader === "N/A") return false;
  try {
    const payloadBuffer = Buffer.from(rawBody, "utf8");
    const signatureBuffer = Buffer.from(signatureHeader, "base64");
    return crypto.verify(null, payloadBuffer, GHL_SIGNATURE_PUBLIC_KEY, signatureBuffer);
  } catch (e) {
    console.error("[CONVO-BOT] webhook signature verification threw:", e.message);
    return false;
  }
}
