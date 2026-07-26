// Ephemeral, per-conversation bot state: the rolling hourly reply counter
// (rate cap) and the handoff flag (silences the bot once a human is needed).
// Excluded from backup (lib/backupStores.js) - both are safe to lose, they
// just self-regenerate from the next inbound message.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "bot-counters";
const RATE_WINDOW_MS = 60 * 60 * 1000;
// A human clearing the "bot-handoff" tag in GHL is the real signal, but this
// app has no way to watch for that tag removal - so the flag also expires on
// its own after a day as a safety net, rather than silencing a conversation
// forever if nobody remembers to intervene.
const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function keyFor(tenant, conversationId) {
  return `${tenant}:${conversationId}`;
}

async function readRecord(tenant, conversationId) {
  return (await store().get(keyFor(tenant, conversationId), { type: "json" })) || {};
}

export async function isHandoffActive(tenant, conversationId) {
  const record = await readRecord(tenant, conversationId);
  if (!record.handoffAt) return false;
  return Date.now() - new Date(record.handoffAt).getTime() < HANDOFF_TTL_MS;
}

export async function setHandoff(tenant, conversationId) {
  const key = keyFor(tenant, conversationId);
  const record = await readRecord(tenant, conversationId);
  record.handoffAt = new Date().toISOString();
  await store().setJSON(key, record);
}

export async function clearHandoff(tenant, conversationId) {
  const key = keyFor(tenant, conversationId);
  const record = await readRecord(tenant, conversationId);
  record.handoffAt = null;
  await store().setJSON(key, record);
}

// Increments and returns the count for the current rolling hour window,
// resetting the window if it's lapsed.
export async function incrementReplyCount(tenant, conversationId) {
  const key = keyFor(tenant, conversationId);
  const record = await readRecord(tenant, conversationId);
  const now = Date.now();
  if (!record.windowStart || now - record.windowStart > RATE_WINDOW_MS) {
    record.windowStart = now;
    record.count = 0;
  }
  record.count = (record.count || 0) + 1;
  await store().setJSON(key, record);
  return record.count;
}
