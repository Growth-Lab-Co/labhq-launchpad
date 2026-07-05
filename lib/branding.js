// Per-tenant branding overrides (currently just a custom favicon), backed by
// Netlify Blobs. Absence of a record just means "use the site default" -
// there's nothing to configure before launch.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "branding";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getBranding(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return record || { faviconUrl: null };
}

export async function setFaviconUrl(tenant, faviconUrl) {
  await store().setJSON(tenant, { faviconUrl: faviconUrl || null, updatedAt: new Date().toISOString() });
}
