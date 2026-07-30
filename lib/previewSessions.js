// Ephemeral "Meet Miia" preview sessions (job 1's preview mode) - a
// visitor pastes their website URL, we scrape basics (lib/scrape.js) and
// spin up a demo brain for a few messages. Deliberately NOT a tenant:
// never touches lib/tenants.js, never gets a GHL sub-account, never
// appears in the signups queue (lib/miiaSignups.js is untouched by this
// file entirely), and expires on its own - no admin cleanup needed.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "preview-sessions";
const TTL_MS = 45 * 60 * 1000; // 45 minutes
export const PREVIEW_MESSAGE_CAP = 10;
export const PREVIEW_EMAIL_GATE_AT = 2; // free messages before the email gate

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `prev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPreviewSession({ url, businessName, servicesSummary, toneHint }) {
  const id = makeId();
  const now = Date.now();
  const record = {
    id,
    url,
    businessName: businessName || "your business",
    servicesSummary: servicesSummary || "",
    toneHint: toneHint || "",
    messageCount: 0,
    email: null,
    messages: [], // kept on the session itself, not lib/widgetConversations - it expires with the session, never lists alongside real tenants' conversations
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  await store().setJSON(id, record);
  return record;
}

// `status` mirrors lib/widgetConversations.js's appendWidgetMessage - see
// its comment. Only set for a reply still being generated in the background.
export async function appendPreviewMessage(id, { direction, body, status }) {
  const record = await getPreviewSession(id);
  if (!record) return null;
  const message = { direction, body, createdAt: new Date().toISOString() };
  if (status) message.status = status;
  record.messages = [...record.messages, message].slice(-40);
  await store().setJSON(id, record);
  return record;
}

// Mirrors lib/widgetConversations.js's resolvePendingWidgetReply - see its
// comment for why searching from the end (rather than tracking a message
// id) is safe here.
export async function resolvePendingPreviewReply(id, { body, status }) {
  const record = await getPreviewSession(id);
  if (!record) return null;
  const messages = record.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].direction === "outbound" && messages[i].status === "pending") {
      messages[i] = { ...messages[i], body, status, resolvedAt: new Date().toISOString() };
      break;
    }
  }
  record.messages = messages;
  await store().setJSON(id, record);
  return record;
}

// Returns null for a missing OR expired session - callers treat both
// identically ("this preview is gone, start a new one"), never
// distinguishing "not found" from "timed out" to the visitor.
export async function getPreviewSession(id) {
  if (!id) return null;
  const record = await store().get(id, { type: "json" });
  if (!record) return null;
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await store().delete(id).catch(() => {});
    return null;
  }
  return record;
}

export async function incrementPreviewMessageCount(id) {
  const record = await getPreviewSession(id);
  if (!record) return null;
  record.messageCount += 1;
  await store().setJSON(id, record);
  return record;
}

export async function setPreviewEmail(id, email) {
  const record = await getPreviewSession(id);
  if (!record) return null;
  record.email = email;
  await store().setJSON(id, record);
  return record;
}
