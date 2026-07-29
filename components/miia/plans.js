// Shared plan data — pricing cards, the home founding strip, and the
// get-started plan picker all read from this one list so the numbers can
// never drift between pages.
//
// Job 3 (2026-07-29 "simplification build"): two self-serve tiers only -
// Chat and Everywhere. The former third self-serve tier (Miia Complete /
// "Everything") is now Miia Voice (VOICE_PLAN below), sold by a 15 minute
// demo instead of instant checkout - see app/api/miia/checkout/route.js's
// VALID_PLANS, which no longer accepts "complete". The Stripe price itself
// is untouched (lib/miiaStripe.js's PLAN_ENV_KEY still maps complete ->
// EVERYTHING) - it's just not reachable through self-serve checkout
// anymore.
export const PLANS = [
  {
    id: "chat",
    name: "Miia Chat",
    tagline: "One channel of your choice",
    price: 99,
    foundingPrice: 79,
    replies: "500 replies a month",
    features: ["One channel of your choice", "500 replies a month", "Trained in one 10 minute chat", "Live in minutes"],
    popular: false,
  },
  {
    id: "everywhere",
    name: "Miia Everywhere",
    tagline: "Web, Facebook, Instagram and SMS",
    price: 249,
    foundingPrice: 199,
    replies: "1,500 replies a month",
    features: [
      "Web chat, Facebook, Instagram and SMS",
      "Your own local SMS number",
      "1,500 replies a month",
      "Live in 48 hours",
    ],
    popular: true,
  },
];

// Not self-serve - no checkout button, no instant plan id to pass around.
// Sold by demo (see components/miia/site.js's BOOKING_URL) because voice
// setup (phone number, call handling, Do Not Call Register compliance) is
// involved enough to warrant a real conversation first.
export const VOICE_PLAN = {
  id: "voice",
  name: "Miia Voice",
  tagline: "She answers your phone",
  priceLabel: "From $399/mo",
  ctaLabel: "Book a 15 minute demo",
};

export const WHITE_GLOVE = {
  name: "White glove setup",
  price: 990,
  tagline: "Want it all done for you? We set up everything and hand your team a training video.",
};

export const FOUNDING_SPOTS = 20;
export const FOUNDING_DISCOUNT = "20% off for life";

// Kept for lookup only, deliberately not in PLANS/the storefront grid -
// an existing tenant on plan:"complete" (the old internal id, unchanged so
// their Stripe subscription keeps working - see lib/miiaStripe.js's
// PLAN_ENV_KEY) still needs their Billing page and admin tooling to
// resolve a real plan name instead of "No plan found". Anyone new gets
// there via VOICE_PLAN's demo path now, never this record directly.
const LEGACY_COMPLETE_PLAN = {
  id: "complete",
  name: "Miia Voice",
  tagline: "Everything, plus she answers your phone",
  price: 399,
  foundingPrice: 319,
  replies: "300 call minutes a month",
};

export function yearlyPerMonth(price) {
  return Math.round((price * 10) / 12);
}

export function yearlyTotal(price) {
  return price * 10;
}

export function getPlan(id) {
  if (id === LEGACY_COMPLETE_PLAN.id) return LEGACY_COMPLETE_PLAN;
  return PLANS.find((p) => p.id === id);
}
