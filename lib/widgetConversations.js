// Conversation storage for the in-house Miia widget (job 1, 2026-07-29
// build) - one record per conversation, backed by Netlify Blobs. Separate
// store from GHL's conversation data (lib/ghl.js's listConversations) since
// these never touch GHL at all - the Conversations dashboard page merges
// both sources (see components/dashboard/ConversationsPageClient.jsx).

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "widget-conversations";
const MAX_MESSAGES = 200;

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// `tenant` is either a real tenant slug or a preview session id
// (lib/previewSessions.js) - `kind` distinguishes the two so the
// Conversations page can filter ephemeral preview chatter out entirely
// (previews never appear there - see MORNING-REPORT.md's ops-queue note,
// same honesty principle applied to conversation history).
export async function createWidgetConversation({ tenant, kind = "tenant", contactName, contactEmail, pageUrl }) {
  const id = makeId();
  const now = new Date().toISOString();
  const record = {
    id,
    tenant,
    kind, // "tenant" | "preview"
    contactName: contactName || null,
    contactEmail: contactEmail || null,
    pageUrl: pageUrl || null,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  await store().setJSON(id, record);
  return record;
}

export async function getWidgetConversation(id) {
  if (!id) return null;
  return store().get(id, { type: "json" });
}

export async function appendWidgetMessage(id, { direction, body }) {
  const record = await getWidgetConversation(id);
  if (!record) return null;
  record.messages = [...record.messages, { direction, body, createdAt: new Date().toISOString() }].slice(-MAX_MESSAGES);
  record.updatedAt = new Date().toISOString();
  await store().setJSON(id, record);
  return record;
}

export async function setWidgetConversationContact(id, { contactEmail }) {
  const record = await getWidgetConversation(id);
  if (!record) return null;
  record.contactEmail = contactEmail;
  record.updatedAt = new Date().toISOString();
  await store().setJSON(id, record);
  return record;
}

// Real tenant conversations only (kind: "tenant") - used by the
// Conversations dashboard page. Preview conversations are looked up
// directly by id (lib/previewSessions.js's own flow) and never listed here.
export async function listWidgetConversationsForTenant(tenantSlug) {
  const { blobs } = await store().list();
  const records = await Promise.all(blobs.map(({ key }) => store().get(key, { type: "json" }).catch(() => null)));
  return records
    .filter((r) => r && r.kind === "tenant" && r.tenant === tenantSlug)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}
