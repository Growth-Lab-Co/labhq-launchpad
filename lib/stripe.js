// Hand-rolled Stripe Checkout + webhook verification - no `stripe` SDK
// dependency, matching how lib/ghlOAuth.js and lib/email.js already avoid
// them. Inert until STRIPE_SECRET_KEY + a price id are set as Netlify env
// vars (never written to a file - see .env.example). Invite codes
// (lib/inviteCodes.js) are the only live activation path today; this exists
// so wiring real keys later is a pure env-var change, no code change.

const STRIPE_API = "https://api.stripe.com/v1";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_FOUNDING);
}

async function stripeFetch(path, params) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Stripe ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Creates a Checkout Session for the "Founding partner" subscription price.
// tenantSlug/accountId travel in `client_reference_id` + metadata so the
// webhook can activate the right account without trusting anything else the
// client sends.
export async function createCheckoutSession({ accountId, tenantSlug, successUrl, cancelUrl }) {
  if (!stripeConfigured()) throw new Error("Stripe isn't configured yet");
  return stripeFetch("/checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": process.env.STRIPE_PRICE_ID_FOUNDING,
    "line_items[0][quantity]": "1",
    client_reference_id: accountId,
    "metadata[accountId]": accountId,
    "metadata[tenantSlug]": tenantSlug,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
}

// Stripe's documented webhook signature scheme: the header is
// `t=<timestamp>,v1=<hmac>`; the signed payload is `${timestamp}.${rawBody}`,
// HMAC-SHA256 with the webhook signing secret, compared with a constant-time
// check. Must be called with the RAW request body (not parsed JSON) or the
// signature will never match.
export async function verifyWebhookSignature(rawBody, sigHeader) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !sigHeader) return false;

  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  if (!parts.t || !parts.v1) return false;

  const { createHmac, timingSafeEqual } = await import("crypto");
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(parts.v1);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
