// Deployment log for Mission Control, backed by Netlify Blobs.
// One blob per deployment, keyed by id. Reads use "strong" consistency so a
// freshly written or updated record shows up immediately on the dashboard.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "deployments";

export const DEPLOYMENT_STATUSES = [
  "deployed",
  "calendar_connected",
  "phone_live",
  "qa_passed",
  "live",
];

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Never throws - a blob outage must not take down a deploy. Returns the
// record on success, null on failure (logged).
export async function recordDeployment({ tenant, businessName, contactName, locationId, demo }) {
  const now = new Date().toISOString();
  const record = {
    id: makeId(),
    tenant,
    businessName: businessName || "",
    contactName: contactName || "",
    locationId: locationId || "",
    demo: Boolean(demo),
    status: "deployed",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await store().setJSON(record.id, record);
    return record;
  } catch (e) {
    console.error("[deployments] failed to write deployment record:", e.message);
    return null;
  }
}

export async function listDeployments(tenant) {
  const { blobs } = await store().list();
  const records = await Promise.all(
    blobs.map(({ key }) => store().get(key, { type: "json" }).catch(() => null))
  );
  return records
    .filter((r) => r && (!tenant || r.tenant === tenant))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// `tenant` scopes the update to records owned by that tenant, so an
// authenticated caller for one tenant can't touch another's records by
// guessing an id.
export async function updateDeploymentStatus(id, status, tenant) {
  if (!DEPLOYMENT_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const s = store();
  const record = await s.get(id, { type: "json" });
  if (!record || record.tenant !== tenant) return null;
  record.status = status;
  record.updatedAt = new Date().toISOString();
  await s.setJSON(id, record);
  return record;
}
