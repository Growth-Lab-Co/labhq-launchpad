// Tracks the Leadsie access-request result for a tenant's Facebook/Instagram
// connection, backed by Netlify Blobs. One record per tenant, overwritten on
// each webhook call (see app/api/leadsie-webhook/route.js) - Leadsie itself
// is the source of truth for what's actually connected; this is just the
// last thing it told us, so the Channels page can show an honest status
// without an extra live API call on every page load.
//
// This does NOT mean Facebook/Instagram is live in GHL - granting Leadsie
// access to the client's pages and wiring that access into GHL's own
// Facebook/Instagram integration are two separate steps (see DEPLOY.md
// "Channel wiring"). Status here only ever reaches "received", never "live" -
// an operator finishing the GHL side is what the ops alert is for.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "leadsie-connections";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getLeadsieConnection(tenant) {
  return store().get(tenant, { type: "json" });
}

export async function saveLeadsieConnection(tenant, { status, assets, clientName, clientSummaryUrl, raw }) {
  const record = {
    tenant,
    status, // "received" | "partial" | "failed"
    assets: assets || [],
    clientName: clientName || "",
    clientSummaryUrl: clientSummaryUrl || "",
    raw: raw || null,
    receivedAt: new Date().toISOString(),
  };
  await store().setJSON(tenant, record);
  return record;
}
