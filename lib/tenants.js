// Tenant registry: SEED tenants (growthlab, obm, demo) are the original
// hand-onboarded doors and are always available with zero Blobs dependency -
// a Blobs outage can never break them. Every other tenant is created
// self-serve through /portal and lives in Netlify Blobs, so adding one needs
// no code change and no redeploy.
//
// envPrefix maps to {PREFIX}_GHL_TOKEN / {PREFIX}_GHL_COMPANY_ID /
// {PREFIX}_GHL_SNAPSHOT_ID (legacy Private Integration Token auth, used only
// by the three SEED tenants). Dynamic tenants omit envPrefix entirely and
// authenticate to GHL purely through the OAuth apps (lib/ghlOAuth.js) - see
// ghlCredsFor below.

import { blobStore } from "./blobsFetch.js";
import { DEFAULT_ACCENT } from "./branding.js";
import { setJSONAtomic } from "./blobsAtomic.js";
import { logActivity } from "./activity.js";

const STORE_NAME = "tenants";

// productType: "miia" | "agency" - the sole flag every dashboard routing/
// rendering decision keys off (see lib/tenants.js tenantProductType() below).
// SEED tenants are code-defined, not Blobs records, so their productType
// lives here as a literal rather than going through the backfill migration
// that covers dynamic tenants (see app/api/admin/tenants/[slug]/product-type).
export const SEED_TENANTS = {
  growthlab: {
    slug: "growthlab",
    name: "Growth Lab Co.",
    assistantName: "Mia",
    logoText: "Growth Lab Co.",
    logoUrl: null,
    accent: "#A070F8",
    accentSoft: "#9878F0",
    envPrefix: null,
    productType: "agency",
    welcome: "the team at Growth Lab Co. is setting up your automated onboarding system",
  },
  obm: {
    slug: "obm",
    name: "On Brand Marketing",
    assistantName: "Mia",
    logoText: "On Brand Marketing",
    logoUrl: "/obm-logo.png",
    accent: "#785E88",
    accentSoft: "#bdd649",
    envPrefix: "OBM",
    productType: "agency",
    welcome: "the team at On Brand Marketing is setting up your automated onboarding system",
  },
  demo: {
    slug: "demo",
    name: "Lab HQ Demo",
    assistantName: "Mia",
    logoText: "Lab HQ",
    logoUrl: null,
    accent: "#A070F8",
    accentSoft: "#9878F0",
    envPrefix: "DEMO", // no DEMO_* vars exist -> always demo mode (no real GHL calls)
    productType: "agency",
    welcome: "the Lab HQ team is walking you through a demo of the automated onboarding system",
  },
};

// Single source of truth for "which dashboard shell does this tenant get" -
// every routing/rendering decision should call this rather than reading
// tenant.productType directly, so an unset/corrupt/legacy value always fails
// safe toward the existing Mission Control UI, never toward the new
// customer dashboard.
export function tenantProductType(tenant) {
  return tenant?.productType === "miia" ? "miia" : "agency";
}

// Reserved so a self-serve signup can't shadow an app route or look official.
// The miia-* entries exist because a static route always wins over the
// [tenant] catch-all - a business named e.g. "Pricing" generating that slug
// would otherwise silently become unreachable (the marketing page always
// wins), not merely inconvenient.
export const RESERVED_SLUGS = [
  "www", "api", "admin", "portal", "app", "mail", "labhq", "assets", "static", "start",
  "features", "pricing", "get-started", "how-it-works", "legal", "allied-health",
  "miia-for-tradies", "miia-for-allied-health", "miia-for-salons",
  "miia-for-gyms", "miia-for-law-firms", "miia-for-real-estate",
  ...Object.keys(SEED_TENANTS),
];

export function validateSlug(slug) {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(String(slug || ""));
}

export function slugAvailable(slug) {
  return validateSlug(slug) && !RESERVED_SLUGS.includes(slug);
}

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

// Async and Blobs-backed for anything outside the SEED set. Every Blobs read
// is wrapped so a Blobs hiccup degrades a dynamic tenant to "not found"
// rather than ever affecting growthlab/obm/demo, which never touch Blobs
// here at all.
export async function getTenant(slug) {
  const key = String(slug || "").toLowerCase();
  if (SEED_TENANTS[key]) return SEED_TENANTS[key];
  try {
    const record = await store().get(key, { type: "json" });
    return record || null;
  } catch (e) {
    console.error(`[tenants] failed to read tenant ${key}:`, e.message);
    return null;
  }
}

export async function listTenants() {
  let dynamic = [];
  try {
    const { blobs } = await store().list();
    const records = await Promise.all(blobs.map(({ key }) => store().get(key, { type: "json" }).catch(() => null)));
    dynamic = records.filter(Boolean);
  } catch (e) {
    console.error("[tenants] failed to list dynamic tenants:", e.message);
  }
  return [...Object.values(SEED_TENANTS), ...dynamic];
}

// Claims a slug atomically - returns the created record, or null if the slug
// was already taken (SEED, reserved, or an existing dynamic tenant).
//
// Optional overrides (all default to the original self-serve /portal
// behaviour, so existing callers are unaffected):
//   envPrefix    - pass null (not omitted) to make ghlCredsFor resolve the
//                  bare GHL_AGENCY_TOKEN/GHL_COMPANY_ID/GHL_SNAPSHOT_ID env
//                  vars, same as the growthlab SEED tenant - these are
//                  documented in .env.example as "used for DIRECT SMB
//                  deployments into YOUR agency account", exactly what a
//                  Miia-provisioned tenant needs. Omit entirely to keep the
//                  default OAuth-only behaviour.
//   assistantName, product, welcome, accent, accentSoft - branding overrides.
export async function createTenant({
  slug,
  name,
  ownerAccountId,
  envPrefix,
  assistantName = "Mia",
  product,
  welcome,
  accent = DEFAULT_ACCENT,
  accentSoft = DEFAULT_ACCENT,
  healthcareMode = false,
  healthcareModeSource = null,
  productType = "agency",
  plan = null,
}) {
  const key = String(slug || "").toLowerCase();
  if (!slugAvailable(key)) return null;

  const now = new Date().toISOString();
  const record = {
    slug: key,
    name,
    assistantName,
    logoText: name,
    logoUrl: null,
    accent,
    accentSoft,
    ...(envPrefix !== undefined ? { envPrefix } : {}),
    ...(product ? { product } : {}),
    // Which Miia plan (chat/everywhere/complete) this tenant is on - only
    // ever set for product:"miia" tenants (see lib/miiaProvisioning.js).
    // Drives plan-aware intake (app/api/chat) and Billing/Channels pages.
    // Agency tenants have no "plan" concept at all - stays null for them.
    plan: plan || null,
    // Fails safe toward "agency" (the existing Mission Control UI) for any
    // creation path that doesn't explicitly ask for "miia" - see
    // tenantProductType() above, the only place this should be read from.
    productType: productType === "miia" ? "miia" : "agency",
    welcome: welcome || `the team at ${name} is setting up your automated onboarding system`,
    ownerAccountId: ownerAccountId || null,
    deployedAt: null,
    // See setHealthcareMode below - two independent triggers can set this
    // (signup source, intake classification), plus a manual ops override.
    healthcareMode: Boolean(healthcareMode),
    healthcareModeSource: healthcareMode ? healthcareModeSource || "signup" : null,
    healthcareModeUpdatedAt: healthcareMode ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  const { modified } = await setJSONAtomic(store(), key, record, { onlyIfNew: true });
  return modified ? record : null;
}

export async function updateTenant(slug, patch) {
  const key = String(slug || "").toLowerCase();
  if (SEED_TENANTS[key]) throw new Error("Seed tenants can't be modified");
  const current = await store().get(key, { type: "json" });
  if (!current) return null;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await store().setJSON(key, next);
  return next;
}

// Archiving is for test/throwaway tenants (e.g. a checkout smoke test) -
// keeps the record (and anything referencing its slug) intact, just marks
// it so getPublicTenant() below stops resolving it. Data-layer only: no
// interaction with checkout, webhook, provisioning or email.
export async function archiveTenant(slug) {
  const key = String(slug || "").toLowerCase();
  if (SEED_TENANTS[key]) throw new Error("Seed tenants can't be archived");
  return updateTenant(key, { archived: true, archivedAt: new Date().toISOString() });
}

export async function unarchiveTenant(slug) {
  const key = String(slug || "").toLowerCase();
  if (SEED_TENANTS[key]) throw new Error("Seed tenants can't be archived");
  return updateTenant(key, { archived: false, archivedAt: null });
}

// Locks a tenant's public intake flow after its one deploy. Only meaningful
// for product:"miia" tenants, where one tenant slug = one specific business
// that already paid via Stripe - callers (app/api/deploy, app/api/chat)
// are responsible for only invoking this for that product. Deliberately NOT
// applied to growthlab/obm-style tenants (SEED, so updateTenant already
// refuses them) or self-serve /portal agency tenants (dynamic, but each
// slug is a reusable agency portal onboarding many different end-clients -
// locking after the first deploy would break that product entirely).
export async function markTenantDeployed(slug) {
  return updateTenant(slug, { deployedAt: new Date().toISOString() });
}

// Manual escape hatch for support: a real customer who needs their setup
// redone (typo'd answers, wrong plan, etc.) has no self-serve way to redo
// it - this clears the lock so the admin can hand them a fresh run. Not
// wired to any UI yet, callable via the admin API with MC_PASSWORD.
export async function resetTenantDeploy(slug) {
  return updateTenant(slug, { deployedAt: null });
}

// Single write path for the healthcare clinical-guardrail flag - two
// automatic triggers (signup source, intake classification, both in
// lib/miiaProvisioning.js / app/api/deploy) and one manual ops override
// (app/api/admin/tenants/[slug]/healthcare-mode) all call this, so there's
// exactly one place that updates the flag AND logs it. `source: "manual"`
// is sticky: once an operator has explicitly set it either way, the two
// automatic triggers leave it alone (see the callers' own guards) rather
// than fighting a human's judgement call.
//
// No-ops (no write, no log) if the value wouldn't actually change, so a
// re-running classifier or a re-fired webhook doesn't spam the activity
// feed. Never throws - a logging hiccup must not break a deploy or an admin
// action; callers that need to know it happened check the returned record.
export async function setHealthcareMode(slug, { enabled, source, actor }) {
  const key = String(slug || "").toLowerCase();
  try {
    const current = await getTenant(key);
    if (!current) return null;
    const next = Boolean(enabled);
    if (current.healthcareMode === next && current.healthcareModeSource === source) return current;

    const updated = await updateTenant(key, {
      healthcareMode: next,
      healthcareModeSource: source || "manual",
      healthcareModeUpdatedAt: new Date().toISOString(),
    });

    await logActivity({
      tenant: key,
      businessName: updated?.name || "",
      type: source === "manual" ? "attention" : "setup",
      text:
        source === "manual"
          ? `Healthcare mode ${next ? "turned ON" : "turned OFF"} manually${actor ? ` by ${actor}` : ""}`
          : `Healthcare mode turned ON automatically (${source})`,
    });

    return updated;
  } catch (e) {
    console.error(`[HEALTHCARE-MODE-FAIL] tenant=${key}`, e.message);
    return null;
  }
}

// The lookup the PUBLIC intake chat page (app/[tenant]/page.jsx) uses -
// an archived tenant is treated as not-found here (404s the public URL)
// without deleting the underlying record. getTenant() itself is
// unaffected - Mission Control and admin tooling keep seeing archived
// tenants.
export async function getPublicTenant(slug) {
  const tenant = await getTenant(slug);
  if (!tenant || tenant.archived) return null;
  return tenant;
}

// Used only as a signup compensating action when the email claim step fails
// right after the tenant record was created - never exposed to end users.
export async function deleteTenant(slug) {
  const key = String(slug || "").toLowerCase();
  if (SEED_TENANTS[key]) return;
  await store().delete(key);
}

export function ghlCredsFor(tenant) {
  if (tenant.envPrefix === undefined) {
    // Dynamic (self-serve) tenant - no legacy Private Integration Token env
    // vars can exist for these, so GHL auth is entirely OAuth (lib/ghl.js
    // already prefers OAuth first and only falls back when configured=true).
    return { token: null, companyId: null, snapshotId: null, configured: false };
  }
  const p = tenant.envPrefix;
  const token = p ? process.env[`${p}_GHL_TOKEN`] : process.env.GHL_AGENCY_TOKEN;
  const companyId = p ? process.env[`${p}_GHL_COMPANY_ID`] : process.env.GHL_COMPANY_ID;
  const snapshotId = p ? process.env[`${p}_GHL_SNAPSHOT_ID`] : process.env.GHL_SNAPSHOT_ID;
  const configured = Boolean(token && companyId && snapshotId);
  return { token, companyId, snapshotId, configured };
}
