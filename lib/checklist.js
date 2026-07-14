// Per-client go-live checklist state, backed by Netlify Blobs. Keyed by
// deployment id so it survives independently of the deployment record.
// Reading a checklist that hasn't been touched yet materialises it from the
// tenant's CURRENT template (lib/checklistTemplate.js), so new clients always
// inherit whatever the template looks like right now.

import { blobStore } from "./blobsFetch.js";
import { getChecklistTemplate } from "@/lib/checklistTemplate";

const STORE_NAME = "checklists";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function key(tenant, deploymentId) {
  return `${tenant}:${deploymentId}`;
}

export async function getChecklist(tenant, deploymentId) {
  const record = await store().get(key(tenant, deploymentId), { type: "json" });
  if (record?.items?.length) return record.items;
  const template = await getChecklistTemplate(tenant);
  return template.map((i) => ({ ...i, checked: false }));
}

export function checklistProgress(items) {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.checked).length / items.length) * 100);
}

export async function toggleChecklistItem(tenant, deploymentId, itemId) {
  const items = await getChecklist(tenant, deploymentId);
  const next = items.map((i) => (i.id === itemId ? { ...i, checked: !i.checked } : i));
  await store().setJSON(key(tenant, deploymentId), { items: next, updatedAt: new Date().toISOString() });
  return next;
}

// Reads progress for many deployments at once (Clients table) without
// materialising+writing anything for clients that haven't been opened yet.
export async function deleteChecklistsForTenant(tenant) {
  const { blobs } = await store().list({ prefix: `${tenant}:` });
  await Promise.all(blobs.map(({ key }) => store().delete(key)));
}

export async function deleteChecklist(tenant, deploymentId) {
  await store().delete(key(tenant, deploymentId));
}

export async function getChecklistProgressBulk(tenant, deploymentIds) {
  const s = store();
  const results = await Promise.all(
    deploymentIds.map((id) => s.get(key(tenant, id), { type: "json" }).catch(() => null))
  );
  const map = {};
  deploymentIds.forEach((id, i) => {
    const record = results[i];
    if (record?.items?.length) {
      map[id] = checklistProgress(record.items);
    } else {
      map[id] = 0;
    }
  });
  return map;
}
