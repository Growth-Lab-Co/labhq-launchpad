// Suggested action buttons under a widget reply (job 1, 2026-07-31) - "See
// pricing", "Get started" etc, jumping straight to the right place instead
// of Miia only ever being able to talk about it. The KEY guarantee: the
// model picks from a fixed, small set of action keys (enforced by
// askClaudeStructured's schema - see lib/bot.js generateReply) and every
// key resolves to a real, already-known URL here, in code - never a URL
// the model writes itself, so it can never invent or mistype a link.
//
// Generic by construction, not hardcoded to meetmiia.com: every kind
// resolves through a tenant's own captured data (website_url, booking_link
// - the same fields Settings lets a customer edit) first. Miia's own
// marketing site, meetmiia.com, is also just a tenant (miia-ai) - it gets
// two extra real destinations (its own /pricing page) because it's the one
// tenant today whose page structure we actually know, not because
// anything here is meetmiia.com-specific. A customer's own site's page
// structure is never assumed - if they haven't told us a real booking
// link or website, that action is simply unavailable, not guessed.
// Relative import, not the "@/" alias - this file is imported both through
// Next.js app routes (which resolve that alias via the bundler) AND
// directly by netlify/functions/widget-reply-background.mjs (plain Node,
// no bundler, no alias resolution at all) via lib/bot.js. Found the hard
// way: `node --check` passes either way, but the alias only actually
// resolves at runtime inside Next's own build.
import { SITE_URL, BOOKING_URL } from "../components/miia/site.js";

// The one tenant this app both builds AND runs its own marketing site for -
// see the header comment above for why this earns two extra hardcoded
// destinations no other tenant gets.
const MIIA_SELF_TENANT_SLUG = "miia-ai";

export const WIDGET_ACTION_KINDS = [
  { key: "pricing", label: "See pricing", when: "the visitor is asking about cost, plans, or how much something is" },
  { key: "get_started", label: "Get started", when: "the visitor sounds ready to sign up or start" },
  { key: "book_demo", label: "Book a demo", when: "the visitor wants to talk to a human or book a call" },
  { key: "website", label: "Visit our website", when: "the visitor wants to browse or learn more generally" },
];

function resolveHref(key, { tenant, deployment }) {
  const cv = deployment?.customValues || {};
  const isMiiaSelf = tenant?.slug === MIIA_SELF_TENANT_SLUG;
  switch (key) {
    case "pricing":
      return isMiiaSelf ? `${SITE_URL}/pricing` : null;
    case "get_started":
      // Same page as pricing for Miia's own site - the pricing cards are
      // the self-serve checkout flow itself, there's no separate signup page.
      return isMiiaSelf ? `${SITE_URL}/pricing` : null;
    case "book_demo":
      return cv.booking_link || (isMiiaSelf ? BOOKING_URL : null);
    case "website":
      return cv.website_url || null;
    default:
      return null;
  }
}

// What the model is actually offered this turn - only kinds with a real,
// resolved destination for THIS tenant. A kind with nothing real behind it
// never reaches the model as an option, let alone the visitor.
export function listAvailableWidgetActions({ tenant, deployment }) {
  return WIDGET_ACTION_KINDS.map((k) => ({ ...k, href: resolveHref(k.key, { tenant, deployment }) })).filter((k) => k.href);
}
