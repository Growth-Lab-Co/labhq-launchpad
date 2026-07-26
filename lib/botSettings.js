// Per-location AI conversation bot settings, backed by Netlify Blobs.
// One record per location (key = "<tenant>:<locationId>"), since a tenant
// can run the bot differently per client. Default is disabled - the bot
// never replies for a location until an operator turns it on in Mission
// Control's "AI Replies" tab.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "bot-settings";

export const DEFAULT_BOT_SETTINGS = {
  enabled: false,
  channels: { sms: true, fb: true, ig: true, webchat: true },
  quietHours: { start: "20:00", end: "07:00", tz: "Australia/Brisbane" },
  handoffKeyword: "human",
  maxRepliesPerConversationPerHour: 6,
};

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function keyFor(tenant, locationId) {
  return `${tenant}:${locationId}`;
}

export async function getBotSettings(tenant, locationId) {
  const record = await store().get(keyFor(tenant, locationId), { type: "json" });
  return {
    ...DEFAULT_BOT_SETTINGS,
    ...record,
    channels: { ...DEFAULT_BOT_SETTINGS.channels, ...(record?.channels || {}) },
    quietHours: { ...DEFAULT_BOT_SETTINGS.quietHours, ...(record?.quietHours || {}) },
  };
}

export async function saveBotSettings(tenant, locationId, patch, updatedBy) {
  const current = await getBotSettings(tenant, locationId);
  const next = {
    ...current,
    ...patch,
    channels: { ...current.channels, ...(patch?.channels || {}) },
    quietHours: { ...current.quietHours, ...(patch?.quietHours || {}) },
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || current.updatedBy || null,
  };
  await store().setJSON(keyFor(tenant, locationId), next);
  return next;
}

export async function deleteBotSettings(tenant, locationId) {
  await store().delete(keyFor(tenant, locationId));
}
