// Per-tenant Mission Control passwords, backed by Netlify Blobs. Each
// agency sets their own password the first time they open their dashboard -
// no shared secret to hand out, nothing to configure before launch.
//
// MC_PASSWORD (optional env var) is a master override: it authenticates
// against ANY tenant, so it doubles as a recovery path if a tenant forgets
// their password, and as a way to rotate one via the API.

import { blobStore } from "./blobsFetch.js";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const STORE_NAME = "mc-auth";
const KEY_LENGTH = 64;

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return { salt, hash };
}

function matchesHash(password, { salt, hash }) {
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function isPasswordConfigured(tenant) {
  const record = await store().get(tenant, { type: "json" });
  return Boolean(record);
}

// Overwrites unconditionally - callers are responsible for checking whether
// the caller is allowed to do that (see the API route).
export async function setPassword(tenant, password) {
  const { salt, hash } = hashPassword(password);
  await store().setJSON(tenant, { salt, hash, updatedAt: new Date().toISOString() });
}

export async function verifyPassword(tenant, password) {
  if (!tenant || !password) return false;
  if (process.env.MC_PASSWORD && password === process.env.MC_PASSWORD) return true;
  const record = await store().get(tenant, { type: "json" });
  if (!record) return false;
  return matchesHash(password, record);
}
