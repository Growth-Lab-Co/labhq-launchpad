// Per-tenant GHL snapshot templates, backed by Netlify Blobs. One is marked
// active - that's the snapshot id createSubAccount() uses at deploy time.
// First read auto-seeds from the tenant's legacy env-configured snapshot id
// (ghlCredsFor) so existing tenants don't lose their current setup when this
// list starts out empty.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "snapshot-templates";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listSnapshotTemplates(tenant, legacySnapshotId) {
  const record = await store().get(tenant, { type: "json" });
  if (record?.items?.length) return record.items;
  if (!legacySnapshotId) return [];

  const now = new Date().toISOString();
  const seeded = [
    { id: makeId(), name: tenant, snapshotId: legacySnapshotId, active: true, createdAt: now, updatedAt: now },
  ];
  await store().setJSON(tenant, { items: seeded });
  return seeded;
}

export async function addSnapshotTemplate(tenant, { name, snapshotId }, legacySnapshotId) {
  if (!name?.trim() || !snapshotId?.trim()) throw new Error("Name and GHL snapshot ID are required");
  const items = await listSnapshotTemplates(tenant, legacySnapshotId);
  const now = new Date().toISOString();
  const item = {
    id: makeId(),
    name: name.trim(),
    snapshotId: snapshotId.trim(),
    active: items.length === 0,
    createdAt: now,
    updatedAt: now,
  };
  const next = [...items, item];
  await store().setJSON(tenant, { items: next });
  return next;
}

export async function renameSnapshotTemplate(tenant, id, name) {
  if (!name?.trim()) throw new Error("Name is required");
  const items = await listSnapshotTemplates(tenant);
  const next = items.map((i) => (i.id === id ? { ...i, name: name.trim(), updatedAt: new Date().toISOString() } : i));
  await store().setJSON(tenant, { items: next });
  return next;
}

export async function setActiveSnapshotTemplate(tenant, id) {
  const items = await listSnapshotTemplates(tenant);
  const now = new Date().toISOString();
  const next = items.map((i) => ({ ...i, active: i.id === id, updatedAt: i.id === id ? now : i.updatedAt }));
  await store().setJSON(tenant, { items: next });
  return next;
}

export async function deleteSnapshotTemplate(tenant, id) {
  const items = await listSnapshotTemplates(tenant);
  const removed = items.find((i) => i.id === id);
  const next = items.filter((i) => i.id !== id);
  if (removed?.active && next.length) next[0].active = true;
  await store().setJSON(tenant, { items: next });
  return next;
}

// Resets a tenant to a single active snapshot template - used by the portal
// onboarding wizard's snapshot step, where re-submitting a corrected id
// should replace rather than accumulate templates.
export async function setPrimarySnapshot(tenant, snapshotId) {
  const now = new Date().toISOString();
  const items = [{ id: makeId(), name: "Default", snapshotId, active: true, createdAt: now, updatedAt: now }];
  await store().setJSON(tenant, { items });
  return items;
}

// Resolves the id to deploy with: the active template's snapshotId, else the
// legacy env-configured one. Never throws - deploy must not break if this
// store is briefly unavailable.
export async function deleteSnapshotTemplatesForTenant(tenant) {
  await store().delete(tenant);
}

export async function getActiveSnapshotId(tenant, legacySnapshotId) {
  try {
    const items = await listSnapshotTemplates(tenant, legacySnapshotId);
    const active = items.find((i) => i.active) || items[0];
    return active?.snapshotId || legacySnapshotId || null;
  } catch (e) {
    console.error("[snapshotTemplates] failed to resolve active snapshot:", e.message);
    return legacySnapshotId || null;
  }
}
