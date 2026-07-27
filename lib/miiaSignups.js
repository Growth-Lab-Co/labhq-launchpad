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

const SIGNUPS_STORE = "miia-signups";
const SESSION_INDEX_STORE = "miia-signups-by-session";

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
    paidAt: paidAt || now,
    tenantSlug: null,
    provisioningStatus: "pending", // pending | success | failed
    provisioningError: null,
    provisioningAttempts: 0,
    welcomeEmailSentAt: null,
    opsAlertSentAt: null,
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
  const deployments = await listDeployments(record.tenantSlug).catch(() => []);
  const latest = deployments[0]; // sorted newest-first
  return {
    ...record,
    intakeStatus: latest ? "complete" : "not_started",
    deployStatus: latest?.status || "not_started",
  };
}

export async function listSignups() {
  const { blobs } = await signupsStore().list();
  const records = await Promise.all(blobs.map(({ key }) => getSignupById(key)));
  const withStatus = await Promise.all(records.filter(Boolean).map(withLiveStatus));
  return withStatus.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
}

export async function getSignupWithStatus(id) {
  const record = await getSignupById(id);
  if (!record) return null;
  return withLiveStatus(record);
}
