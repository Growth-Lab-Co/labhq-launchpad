// Miia's Stripe integration - a brand new, dedicated Stripe account,
// completely separate from lib/stripe.js (LabHQ's agency-founding-offer
// Stripe). Same hand-rolled fetch approach (no `stripe` SDK dependency,
// matching lib/stripe.js/lib/ghlOAuth.js/lib/email.js), own env var
// namespace so the two integrations can never collide:
//   MIIA_STRIPE_SECRET_KEY, MIIA_STRIPE_WEBHOOK_SECRET,
//   MIIA_STRIPE_PRICE_* (nine price ids), MIIA_FOUNDING_MODE.
//
// Plan id note: the site's plan id for the top tier is "complete" (Miia
// Complete, url ?plan=complete) but the Stripe env vars for it are named
// EVERYTHING_* (matching the price nicknames Stripe was set up with) - see
// PLAN_ENV_KEY below for the one place that mapping lives.

const STRIPE_API = "https://api.stripe.com/v1";

const PLAN_ENV_KEY = { chat: "CHAT", everywhere: "EVERYWHERE", complete: "EVERYTHING" };

export function foundingMode() {
  return process.env.MIIA_FOUNDING_MODE === "true";
}

export function miiaStripeConfigured() {
  return Boolean(process.env.MIIA_STRIPE_SECRET_KEY);
}

async function stripeFetch(path, params) {
  const secretKey = process.env.MIIA_STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("MIIA_STRIPE_SECRET_KEY is not set");
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

async function stripeGet(path) {
  const secretKey = process.env.MIIA_STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("MIIA_STRIPE_SECRET_KEY is not set");
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
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

// Resolves which Stripe price id to charge for a plan - server-side only,
// never trust the client to pick the price. Founding is monthly-only: a
// Yearly ALWAYS resolves to the standard yearly price, regardless of
// founding mode - there is no founding-yearly price id (only three
// founding prices exist and all three are monthly), so choosing yearly is
// what takes a customer out of founding pricing, not a global mode switch.
export function resolvePriceId({ plan, billingPeriod }) {
  const key = PLAN_ENV_KEY[plan];
  if (!key) throw new Error(`Unknown plan: ${plan}`);

  if (billingPeriod === "yearly") {
    return process.env[`MIIA_STRIPE_PRICE_${key}_YEARLY`];
  }
  if (foundingMode()) {
    return process.env[`MIIA_STRIPE_PRICE_${key}_FOUNDING`];
  }
  return process.env[`MIIA_STRIPE_PRICE_${key}_MONTHLY`];
}

// Creates a Checkout Session for a Miia plan. White Glove is an optional
// add-on via Stripe's `optional_items` (not `line_items`) - regular
// line_items reject quantity 0 outright ("must be greater than or equal to
// 1", confirmed against the live API), so a quantity-0-adjustable-to-1
// line item doesn't work. optional_items is the actual primitive Stripe
// Checkout has for "shown as an add-on, unticked by default".
export async function createMiiaCheckoutSession({ plan, billingPeriod, successUrl, cancelUrl }) {
  if (!miiaStripeConfigured()) throw new Error("Miia Stripe isn't configured yet");

  const priceId = resolvePriceId({ plan, billingPeriod });
  if (!priceId) throw new Error(`No price configured for plan=${plan} billingPeriod=${billingPeriod} founding=${foundingMode()}`);

  const whiteGlovePriceId = process.env.MIIA_STRIPE_PRICE_WHITEGLOVE_ONCE;

  const params = {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "phone_number_collection[enabled]": "true",
    "custom_fields[0][key]": "business_name",
    "custom_fields[0][label][type]": "custom",
    "custom_fields[0][label][custom]": "Business name",
    "custom_fields[0][type]": "text",
    "custom_fields[0][text][minimum_length]": "1",
    "custom_fields[1][key]": "contact_name",
    "custom_fields[1][label][type]": "custom",
    "custom_fields[1][label][custom]": "Your name",
    "custom_fields[1][type]": "text",
    "custom_fields[1][text][minimum_length]": "1",
    allow_promotion_codes: "false",
    "metadata[plan]": plan,
    "metadata[billingPeriod]": billingPeriod || "monthly",
    "metadata[founding]": String(foundingMode()),
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  if (whiteGlovePriceId) {
    params["optional_items[0][price]"] = whiteGlovePriceId;
    params["optional_items[0][quantity]"] = "1";
    params["optional_items[0][adjustable_quantity][enabled]"] = "true";
    params["optional_items[0][adjustable_quantity][minimum]"] = "0";
    params["optional_items[0][adjustable_quantity][maximum]"] = "1";
  }

  return stripeFetch("/checkout/sessions", params);
}

// Used by both the webhook and the success page's synchronous path to get
// the canonical, fully-expanded session - never trust the webhook payload's
// embedded object for line_items (Stripe doesn't expand those in the event
// itself), and never trust a session_id from the browser without verifying
// it against Stripe first.
export async function retrieveCheckoutSession(sessionId) {
  if (!miiaStripeConfigured()) throw new Error("Miia Stripe isn't configured yet");
  const qs = new URLSearchParams({
    "expand[0]": "line_items",
    "expand[1]": "line_items.data.price",
  }).toString();
  return stripeGet(`/checkout/sessions/${encodeURIComponent(sessionId)}?${qs}`);
}

function customFieldValue(session, key) {
  const field = session.custom_fields?.find((f) => f.key === key);
  return field?.text?.value?.trim() || "";
}

// Single place that turns a (retrieved, expanded) Stripe session into the
// shape lib/miiaSignups.findOrCreateSignup expects - shared by the webhook
// and the success-page status route so they can never disagree.
export function extractSignupInputFromSession(session) {
  const whiteGloveLineItem = session.line_items?.data?.find(
    (li) => li.price?.id === process.env.MIIA_STRIPE_PRICE_WHITEGLOVE_ONCE
  );
  return {
    stripeCheckoutSessionId: session.id,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    stripeSubscriptionId:
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null,
    businessName: customFieldValue(session, "business_name"),
    contactName: customFieldValue(session, "contact_name"),
    email: session.customer_details?.email || session.customer_email || "",
    phone: session.customer_details?.phone || "",
    plan: session.metadata?.plan || "",
    billingPeriod: session.metadata?.billingPeriod || "monthly",
    founding: session.metadata?.founding === "true",
    whiteGlove: Boolean(whiteGloveLineItem && whiteGloveLineItem.quantity > 0),
    paidAt: new Date().toISOString(),
  };
}

// Same verified-webhook-signature scheme as lib/stripe.js, own secret.
export async function verifyMiiaWebhookSignature(rawBody, sigHeader) {
  const secret = process.env.MIIA_STRIPE_WEBHOOK_SECRET;
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
