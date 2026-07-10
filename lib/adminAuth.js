// Operator admin console auth - gated entirely on MC_PASSWORD (the same
// master override already used for any tenant's Mission Control). There's
// only one operator credential; nothing per-tenant here.
import { timingSafeEqual } from "crypto";

export function adminConfigured() {
  return Boolean(process.env.MC_PASSWORD);
}

export function verifyAdminKey(key) {
  const expected = process.env.MC_PASSWORD;
  if (!expected || !key) return false;
  const a = Buffer.from(String(key));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
