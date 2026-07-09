// Per-tenant notification toggle preferences, backed by Netlify Blobs.
// Storage only - no email dispatch is wired up yet, these just persist what
// the operator chose so the Settings UI is honest about saved state.

import { getStore } from "@netlify/blobs";
import { NOTIFICATION_TOGGLES } from "@/lib/notificationDefinitions";

const STORE_NAME = "notification-settings";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function defaults() {
  return Object.fromEntries(NOTIFICATION_TOGGLES.map((n) => [n.id, n.default]));
}

export async function getNotificationSettings(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return { ...defaults(), ...record };
}

export async function saveNotificationSettings(tenant, settings) {
  const current = await getNotificationSettings(tenant);
  const next = { ...current, ...settings, updatedAt: new Date().toISOString() };
  await store().setJSON(tenant, next);
  return next;
}
