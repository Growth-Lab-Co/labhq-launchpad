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

import { getStore } from "@netlify/blobs";
import { DEFAULT_ACCENT } from "./branding.js";

const STORE_NAME = "tenants";

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
    welcome: "the Lab HQ team is walking you through a demo of the automated onboarding system",
  },
};

// Reserved so a self-serve signup can't shadow an app route or look official.
export const RESERVED_SLUGS = [
  "www", "api", "admin", "portal", "app", "mail", "labhq", "assets", "static",
  ...Object.keys(SEED_TENANTS),
];

export function validateSlug(slug) {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(String(slug || ""));
}

export function slugAvailable(slug) {
  return validateSlug(slug) && !RESERVED_SLUGS.includes(slug);
}

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
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
export async function createTenant({ slug, name, ownerAccountId }) {
  const key = String(slug || "").toLowerCase();
  if (!slugAvailable(key)) return null;

  const now = new Date().toISOString();
  const record = {
    slug: key,
    name,
    assistantName: "Mia",
    logoText: name,
    logoUrl: null,
    accent: DEFAULT_ACCENT,
    accentSoft: DEFAULT_ACCENT,
    // No envPrefix: dynamic tenants have no legacy PIT env vars and
    // authenticate to GHL purely through the OAuth apps - see ghlCredsFor.
    welcome: `the team at ${name} is setting up your automated onboarding system`,
    ownerAccountId: ownerAccountId || null,
    createdAt: now,
    updatedAt: now,
  };

  const { modified } = await store().setJSON(key, record, { onlyIfNew: true });
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
