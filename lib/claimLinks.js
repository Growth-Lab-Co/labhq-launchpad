// One-time claim links for adopting an EXISTING hand-onboarded tenant (e.g.
// obm) into the self-serve portal without redoing onboarding. Operator-
// generated (MC_PASSWORD-gated, see app/api/admin/claims), redeemed once via
// compare-and-swap so it can't be replayed. Only one active (unused,
// unexpired) link exists per tenant slug at a time - generating a new one
// for a slug that already has one just returns the existing link instead of
// minting a second live one.

import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { setJSONAtomic } from "./blobsAtomic.js";

const LINKS_STORE = "claim-links";
const BY_TENANT_STORE = "claim-links-by-tenant";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function linksStore() {
  return getStore({ name: LINKS_STORE, consistency: "strong" });
}
function byTenantStore() {
  return getStore({ name: BY_TENANT_STORE, consistency: "strong" });
}

function isLive(record) {
  return Boolean(record && !record.usedAt && record.expiresAt > Date.now());
}

export async function createOrReuseClaimLink({ tenantSlug, planLabel }) {
  const slug = String(tenantSlug || "").trim().toLowerCase();
  if (!slug) throw new Error("tenantSlug is required");

  const pointer = await byTenantStore().get(slug, { type: "json" });
  if (pointer?.token) {
    const existing = await linksStore().get(pointer.token, { type: "json" });
    if (isLive(existing)) return existing;
  }

  const token = randomUUID() + randomUUID();
  const now = Date.now();
  const record = {
    token,
    tenantSlug: slug,
    planLabel: (planLabel || "Founding partner").trim(),
    createdAt: now,
    expiresAt: now + TTL_MS,
    usedAt: null,
  };
  await linksStore().set(token, JSON.stringify(record));
  await byTenantStore().setJSON(slug, { token });
  return record;
}

export async function listClaimLinks() {
  const { blobs } = await linksStore().list();
  const records = await Promise.all(blobs.map(({ key }) => linksStore().get(key, { type: "json" }).catch(() => null)));
  return records.filter(Boolean).sort((a, b) => b.createdAt - a.createdAt);
}

// Read-only peek - used to render the claim page before anything is
// consumed.
export async function getClaimLink(token) {
  const record = await linksStore().get(String(token || ""), { type: "json" });
  return isLive(record) ? record : null;
}

// Atomic single-use redemption via compare-and-swap.
export async function redeemClaimLink(token) {
  const key = String(token || "");
  if (!key) return null;
  const result = await linksStore().getWithMetadata(key, { type: "json" });
  if (!result) return null;
  const { data: record, etag } = result;
  if (!isLive(record)) return null;

  const { modified } = await setJSONAtomic(linksStore(), key, { ...record, usedAt: new Date().toISOString() }, { onlyIfMatch: etag });
  if (!modified) return null;
  return record;
}
