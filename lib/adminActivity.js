// Operator-facing audit log for the admin console (currently just tenant
// removal), backed by Netlify Blobs. One growing list in a single blob -
// mirrors lib/activity.js's shape, but that one is per-tenant Mission
// Control activity; this is a global, operator-only trail with no tenant
// scoping, viewed at /admin/activity.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "admin-activity";
const KEY = "log";
const MAX_ENTRIES = 500;

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Never throws - an audit-log write failure must not block the action being
// logged (matches lib/activity.js's logActivity).
export async function logAdminActivity({ action, detail }) {
  try {
    const s = store();
    const record = (await s.get(KEY, { type: "json" })) || { entries: [] };
    const entry = { id: makeId(), action, detail: detail || null, createdAt: new Date().toISOString() };
    record.entries = [entry, ...record.entries].slice(0, MAX_ENTRIES);
    await s.setJSON(KEY, record);
    return entry;
  } catch (e) {
    console.error("[admin-activity] failed to log:", e.message);
    return null;
  }
}

export async function listAdminActivity() {
  const record = await store().get(KEY, { type: "json" });
  return record?.entries || [];
}
