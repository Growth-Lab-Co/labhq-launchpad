// Server-side intake conversation drafts - the source of truth for an
// in-progress interview (messages + captured answers so far), so any
// device can resume via the plain tenant URL or the welcome-email link,
// and so a downstream failure (generate/deploy) can never discard a
// finished interview. components/Chat.jsx's localStorage copy is now just
// a same-device cache for a fast first paint, not the source of truth.
//
// One draft per tenant slug - an undeployed Miia tenant has at most one
// active interview (deploy locks the tenant forever, see lib/tenants.js's
// markTenantDeployed), so the slug is a clean natural key, no session id
// needed. Encrypted at rest the same way as lib/miiaSignups.js - answers
// carry the same class of customer PII (contact name, phone, escalation
// contact, business details).

import { blobStore } from "./blobsFetch.js";
import { encrypt, decrypt } from "./crypto.js";

const STORE_NAME = "miia-intake-drafts";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

async function getRaw(tenantSlug) {
  const raw = await store().get(tenantSlug);
  if (!raw) return null;
  try {
    return decrypt(raw);
  } catch (e) {
    console.error(`[intakeDrafts] failed to decrypt draft for ${tenantSlug}:`, e.message);
    return null;
  }
}

// Called on every /api/chat turn - upserts the whole conversation state
// under the tenant's slug. Never throws: a Blobs hiccup here must not break
// the customer's actual conversation (worse case, this turn's progress
// isn't saved and the next turn's save tries again).
export async function saveIntakeDraft(tenantSlug, { messages, answers }) {
  if (!tenantSlug) return;
  try {
    const existing = await getRaw(tenantSlug);
    const now = new Date().toISOString();
    const record = {
      tenantSlug,
      messages: messages || [],
      answers: answers || {},
      turnCount: (messages || []).filter((m) => m.role === "user").length,
      startedAt: existing?.startedAt || now,
      updatedAt: now,
    };
    await store().set(tenantSlug, encrypt(record));
  } catch (e) {
    console.error(`[intakeDrafts] failed to save draft for ${tenantSlug}:`, e.message);
  }
}

// Read path for both resume (app/api/chat's GET) and ops recovery (admin).
export async function getIntakeDraft(tenantSlug) {
  if (!tenantSlug) return null;
  return getRaw(tenantSlug);
}

// Called once deploy succeeds - the draft has done its job and its answers
// now live in the deployment record proper. Don't keep a second copy of
// this customer PII around longer than needed.
export async function clearIntakeDraft(tenantSlug) {
  if (!tenantSlug) return;
  try {
    await store().delete(tenantSlug);
  } catch (e) {
    console.error(`[intakeDrafts] failed to clear draft for ${tenantSlug}:`, e.message);
  }
}

// Lightweight status for the ops queue (/admin/miia-signups) - never
// returns the answers themselves, just enough to tell "stalled" from
// "not started" from "genuinely just paid and hasn't opened the chat yet".
export async function getIntakeProgress(tenantSlug) {
  const draft = await getIntakeDraft(tenantSlug);
  if (!draft) return { status: "not_started", turnCount: 0 };
  return { status: "in_progress", turnCount: draft.turnCount };
}
