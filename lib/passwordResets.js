// Password reset tokens for portal accounts - single-use, time-limited,
// backed by Netlify Blobs. Created either automatically (forgot-password,
// emailed via Resend when RESEND_API_KEY is set) or by an operator from the
// admin console when it isn't (see app/api/admin/resets/route.js).

import { getStore } from "@netlify/blobs";
import { randomUUID } from "crypto";
import { setJSONAtomic } from "./blobsAtomic.js";

const STORE_NAME = "password-resets";
const TTL_MS = 60 * 60 * 1000; // 1 hour

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function createResetToken(accountId) {
  const token = randomUUID() + randomUUID();
  const now = Date.now();
  const record = { accountId, createdAt: now, expiresAt: now + TTL_MS, usedAt: null };
  await setJSONAtomic(store(), token, record, { onlyIfNew: true });
  return token;
}

// Single-use via compare-and-swap: if two requests race to redeem the same
// token, only the first setJSON with a matching etag wins.
export async function redeemResetToken(token) {
  const key = String(token || "");
  if (!key) return null;
  const result = await store().getWithMetadata(key, { type: "json" });
  if (!result) return null;
  const { data: record, etag } = result;
  if (!record || record.usedAt || record.expiresAt < Date.now()) return null;

  const { modified } = await setJSONAtomic(
    store(),
    key,
    { ...record, usedAt: new Date().toISOString() },
    { onlyIfMatch: etag }
  );
  if (!modified) return null; // someone else redeemed it first
  return record.accountId;
}
