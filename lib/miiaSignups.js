// Miia checkout signups - the "ops queue" at /admin/miia-signups. Backed by
// Netlify Blobs, encrypted at rest (same AES-256-GCM as lib/accounts.js,
// since these records carry customer PII: name, email, phone).
//
// One record per Stripe Checkout Session, keyed by a fresh UUID and indexed
// by session id so both the webhook and the success-page's synchronous path
// can find-or-create the same record without racing each other into two.
//
// intakeStatus/deployStatus are NOT stored - they're derived live from
// lib/deployments.js at read time, because storing a cached copy would
// silently go stale. The five-item ops checklist IS stored, because those
// are genuinely manual: nothing else in the system knows whether a human
// clicked "channels wired".

import { blobStore } from "./blobsFetch.js";
import { randomUUID } from "crypto";
import { encrypt, decrypt } from "./crypto.js";
import { setJSONAtomic } from "./blobsAtomic.js";
import { listDeployments } from "./deployments.js";
import { getTenant } from "./tenants.js";

const SIGNUPS_STORE = "miia-signups";
const SESSION_INDEX_STORE = "miia-signups-by-session";
const TENANT_INDEX_STORE = "miia-signups-by-tenant";

export const OPS_CHECKLIST_ITEMS = [
  { id: "consentClick", label: "Consent click" },
  { id: "channelsWired", label: "Channels wired" },
  { id: "numberPurchased", label: "Number purchased" },
  { id: "bundleSubmitted", label: "Bundle submitted" },
  { id: "day2Check", label: "Day-2 check" },
];

function defaultChecklist() {
  return Object.fromEntries(OPS_CHECKLIST_ITEMS.map((i) => [i.id, false]));
}

function signupsStore() {
  return blobStore({ name: SIGNUPS_STORE, consistency: "strong" });
}
function sessionIndexStore() {
  return blobStore({ name: SESSION_INDEX_STORE, consistency: "strong" });
}
function tenantIndexStore() {
  return blobStore({ name: TENANT_INDEX_STORE, consistency: "strong" });
}

async function save(record) {
  await signupsStore().set(record.id, encrypt(record));
}

export async function getSignupById(id) {
  if (!id) return null;
  const raw = await signupsStore().get(id);
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch (e) {
    console.error(`[miiaSignups] failed to decrypt signup ${id}:`, e.message);
    return null;
  }
}

export async function getSignupBySessionId(sessionId) {
  if (!sessionId) return null;
  const index = await sessionIndexStore().get(sessionId, { type: "json" });
  if (!index?.signupId) return null;
  return getSignupById(index.signupId);
}

// Backs the customer dashboard's magic-link request flow and Billing/
// Channels pages - "does this email own this tenant" / "what plan is this
// tenant on" need a fast tenantSlug -> signup lookup rather than scanning
// every signup. Written whenever updateSignup sets a NEW tenantSlug (see
// below) - but that index doesn't exist retroactively for any signup whose
// tenantSlug was already set before this index was added, so a miss here
// falls back to a full scan (fine at current volume) and self-heals the
// index for next time rather than requiring a one-off migration.
export async function getSignupByTenantSlug(tenantSlug) {
  if (!tenantSlug) return null;
  const index = await tenantIndexStore().get(tenantSlug, { type: "json" });
  if (index?.signupId) {
    const signup = await getSignupById(index.signupId);
    if (signup) return signup;
  }

  const { blobs } = await signupsStore().list();
  const records = await Promise.all(blobs.map(({ key }) => getSignupById(key)));
  const match = records.find((r) => r?.tenantSlug === tenantSlug);
  if (match) await tenantIndexStore().setJSON(tenantSlug, { signupId: match.id });
  return match || null;
}

// Idempotent: if a record already exists for this checkout session (webhook
// and the success-page path can both call this for the same session), the
// existing record is returned untouched rather than creating a duplicate.
export async function findOrCreateSignup({
  stripeCheckoutSessionId,
  stripeCustomerId,
  stripeSubscriptionId,
  businessName,
  contactName,
  email,
  phone,
  plan,
  billingPeriod,
  founding,
  whiteGlove,
  vertical,
  utmSource,
  utmMedium,
  utmCampaign,
  paidAt,
}) {
  const existing = await getSignupBySessionId(stripeCheckoutSessionId);
  if (existing) return existing;

  const id = randomUUID();
  const { modified } = await setJSONAtomic(
    sessionIndexStore(),
    stripeCheckoutSessionId,
    { signupId: id },
    { onlyIfNew: true }
  );
  if (!modified) {
    // Lost the race to a concurrent call - use whichever record won.
    return getSignupBySessionId(stripeCheckoutSessionId);
  }

  const now = new Date().toISOString();
  const record = {
    id,
    stripeCheckoutSessionId,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    businessName: businessName || "",
    contactName: contactName || "",
    email: email || "",
    phone: phone || "",
    plan,
    billingPeriod,
    founding: Boolean(founding),
    whiteGlove: Boolean(whiteGlove),
    // Which vertical page's CTA the signup came through, if any - see
    // lib/guardrails.js HEALTH_VERTICAL_SLUGS. Kept as the raw slug (not a
    // derived boolean) so the record stays an honest audit trail even if the
    // set of health verticals changes later.
    vertical: vertical || "",
    utmSource: utmSource || "",
    utmMedium: utmMedium || "",
    utmCampaign: utmCampaign || "",
    paidAt: paidAt || now,
    tenantSlug: null,
    provisioningStatus: "pending", // pending | success | failed
    provisioningError: null,
    provisioningAttempts: 0,
    welcomeEmailSentAt: null,
    opsAlertSentAt: null,
    archived: false,
    archivedAt: null,
    checklist: defaultChecklist(),
    createdAt: now,
    updatedAt: now,
  };
  await save(record);
  return record;
}

export async function updateSignup(id, patch) {
  const record = await getSignupById(id);
  if (!record) return null;
  const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
  await save(next);
  // Best-effort only - getSignupByTenantSlug already falls back to a full
  // scan when this index is missing an entry, so a hiccup writing it must
  // never take down the caller (this fed into the 2026-07-28 "welcome
  // email silently never sent" incident: an uncaught throw here killed
  // the entire provisioning call before it ever reached the email step).
  if (patch.tenantSlug && patch.tenantSlug !== record.tenantSlug) {
    try {
      await tenantIndexStore().setJSON(patch.tenantSlug, { signupId: next.id });
    } catch (e) {
      console.error(`[miiaSignups] tenant index write failed for ${patch.tenantSlug}:`, e.message);
    }
  }
  return next;
}

export async function updateSignupChecklist(id, itemId, value) {
  if (!OPS_CHECKLIST_ITEMS.some((i) => i.id === itemId)) {
    throw new Error(`Unknown checklist item: ${itemId}`);
  }
  const record = await getSignupById(id);
  if (!record) return null;
  const next = {
    ...record,
    checklist: { ...record.checklist, [itemId]: Boolean(value) },
    updatedAt: new Date().toISOString(),
  };
  await save(next);
  return next;
}

// Derives intake/deploy status live from lib/deployments.js rather than
// trusting a stored copy - see file header.
async function withLiveStatus(record) {
  if (!record.tenantSlug) {
    return { ...record, intakeStatus: "not_started", deployStatus: "not_started" };
  }
  const [deployments, tenant] = await Promise.all([
    listDeployments(record.tenantSlug).catch(() => []),
    getTenant(record.tenantSlug).catch(() => null),
  ]);
  const latest = deployments[0]; // sorted newest-first
  return {
    ...record,
    intakeStatus: latest ? "complete" : "not_started",
    deployStatus: latest?.status || "not_started",
    healthcareMode: Boolean(tenant?.healthcareMode),
    healthcareModeSource: tenant?.healthcareModeSource || null,
  };
}

// Archived signups (test/throwaway checkouts) are hidden by default - the
// queue is for real customers ops needs to action, not test noise.
// includeArchived:true is used by the "show archived" toggle only.
export async function listSignups({ includeArchived = false } = {}) {
  const { blobs } = await signupsStore().list();
  const records = await Promise.all(blobs.map(({ key }) => getSignupById(key)));
  const visible = records.filter(Boolean).filter((r) => includeArchived || !r.archived);
  const withStatus = await Promise.all(visible.map(withLiveStatus));
  return withStatus.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
}

export async function archiveSignup(id) {
  return updateSignup(id, { archived: true, archivedAt: new Date().toISOString() });
}

export async function unarchiveSignup(id) {
  return updateSignup(id, { archived: false, archivedAt: null });
}

export async function getSignupWithStatus(id) {
  const record = await getSignupById(id);
  if (!record) return null;
  return withLiveStatus(record);
}
