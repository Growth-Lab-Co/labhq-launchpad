// Per-tenant notification toggle preferences, backed by Netlify Blobs.
// Storage only - no email dispatch is wired up yet, these just persist what
// the operator chose so the Settings UI is honest about saved state.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "notification-settings";

export const NOTIFICATION_TOGGLES = [
  { id: "client_deployed", label: "New client deployed", help: "When a new client system is deployed", default: true },
  { id: "needs_attention", label: "Client needs attention", help: "When a client's data sync needs authorisation", default: true },
  { id: "checklist_ticked", label: "Checklist item ticked", help: "Every time a go-live checklist item is completed", default: false },
  { id: "marked_live", label: "Client marked live", help: "When a client's status is set to Live", default: true },
];

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
