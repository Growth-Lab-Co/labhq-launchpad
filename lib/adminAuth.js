// Operator admin console auth - gated entirely on MC_PASSWORD (the same
// master override already used for any tenant's Mission Control). There's
// only one operator credential; nothing per-tenant here.
import { timingSafeEqual } from "crypto";
import { checkRateLimit, getClientIp } from "./rateLimit.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

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

// Every admin API route checks the x-mc-key header independently (each is
// its own resource, not funnelled through a single login endpoint), so
// rate-limiting only /api/admin/auth would leave the key bruteforceable
// directly against any of the others. This wraps the check with the same
// per-IP limit so every admin route is covered the same way. Returns
// { authorized, rateLimited, retryAfterSeconds } rather than a bare boolean
// so callers can return 429 (with Retry-After) instead of a plain 401 when
// the limit itself is what blocked the request.
export async function verifyAdminRequest(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({ route: "admin-key", ip, max: MAX_ATTEMPTS, windowMs: WINDOW_MS });
  if (!allowed) return { authorized: false, rateLimited: true, retryAfterSeconds };
  return { authorized: verifyAdminKey(req.headers.get("x-mc-key")), rateLimited: false };
}
