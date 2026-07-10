// Cross-client activity feed, backed by Netlify Blobs. One growing list per
// tenant, appended to by the API routes that cause something noteworthy to
// happen (deploy, retry-sync, status change, checklist tick). Never throws -
// activity logging is a nicety, not something that should take down a deploy.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "activity";
const MAX_ENTRIES = 500;

export const ACTIVITY_TYPES = ["deployment", "go-live", "attention", "setup", "general"];

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `act-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function logActivity({ tenant, deploymentId, businessName, type, text }) {
  try {
    const s = store();
    const record = (await s.get(tenant, { type: "json" })) || { entries: [] };
    const entry = {
      id: makeId(),
      deploymentId: deploymentId || null,
      businessName: businessName || "",
      type: ACTIVITY_TYPES.includes(type) ? type : "general",
      text,
      createdAt: new Date().toISOString(),
    };
    record.entries = [entry, ...record.entries].slice(0, MAX_ENTRIES);
    await s.setJSON(tenant, record);
    return entry;
  } catch (e) {
    console.error("[activity] failed to log activity:", e.message);
    return null;
  }
}

export async function listActivity(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return record?.entries || [];
}
