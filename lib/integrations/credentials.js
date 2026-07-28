// Per-tenant practice-software connection records, backed by Netlify Blobs.
// One record per tenant. Credentials are encrypted at rest with the same
// AES-256-GCM pattern as GHL OAuth tokens (lib/crypto.js) - never stored
// plaintext, never logged, and getConnection()'s "public" variant below
// never sends them back to the browser after entry.
//
// Provider-agnostic on purpose: `provider` says which adapter
// (lib/integrations/registry.js) the credentials belong to, so this one
// store covers Cliniko today and Halaxy (or anything else) later without a
// schema change.

import { blobStore } from "../blobsFetch.js";
import { encrypt, decrypt } from "../crypto.js";

const STORE_NAME = "practice-integrations";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

// Full record, credentials decrypted - server-only, never return this
// object directly from an API route.
export async function getConnection(tenant) {
  const record = await store().get(tenant, { type: "json" });
  if (!record) return null;
  let credentials = null;
  if (record.credentials) {
    try {
      credentials = decrypt(record.credentials);
    } catch (e) {
      console.error(`[integrations] failed to decrypt credentials for ${tenant}:`, e.message);
    }
  }
  return { ...record, credentials };
}

// Safe to return from an API route - status/meta only, never the key itself.
export async function getConnectionPublic(tenant) {
  const record = await store().get(tenant, { type: "json" });
  if (!record) return null;
  const { credentials, ...rest } = record;
  return rest;
}

export async function saveConnection(tenant, { provider, credentials, status, meta }) {
  const record = {
    tenant,
    provider,
    credentials: credentials ? encrypt(credentials) : null,
    status, // "connected" | "invalid" | "disconnected"
    meta: meta || null,
    updatedAt: new Date().toISOString(),
  };
  await store().setJSON(tenant, record);
  return record;
}

export async function deleteConnection(tenant) {
  await store().delete(tenant);
}
