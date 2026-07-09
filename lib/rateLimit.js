// Blobs-backed fixed-window rate limiter for the portal's auth endpoints
// (signup, login, forgot-password, reset-password, claim-link redemption).
// Eventual consistency is fine here - this is a brute-force deterrent, not a
// correctness-critical path, and it's cheaper/faster than strong reads on
// every auth attempt.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "rate-limits";

function store() {
  return getStore({ name: STORE_NAME, consistency: "eventual" });
}

export function getClientIp(req) {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// Returns { allowed, retryAfterSeconds }. `route` should be a short constant
// (e.g. "signup", "login") - keys are spread across many IP-suffixed blobs
// rather than one hot key per route.
export async function checkRateLimit({ route, ip, max, windowMs }) {
  const key = `ratelimit:${route}:${ip}`;
  const now = Date.now();
  let record;
  try {
    record = await store().get(key, { type: "json" });
  } catch (e) {
    console.error(`[rateLimit] read failed for ${key}:`, e.message);
    return { allowed: true }; // fail open - a Blobs hiccup shouldn't lock everyone out
  }

  if (!record || now - record.windowStart > windowMs) {
    record = { count: 1, windowStart: now };
  } else {
    record.count += 1;
  }

  try {
    await store().setJSON(key, record);
  } catch (e) {
    console.error(`[rateLimit] write failed for ${key}:`, e.message);
  }

  if (record.count > max) {
    const retryAfterSeconds = Math.ceil((record.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }
  return { allowed: true };
}
