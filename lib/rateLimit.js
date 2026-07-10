// Blobs-backed fixed-window rate limiter for the portal's auth endpoints
// (signup, login, forgot-password, reset-password, claim-link redemption).
//
// Uses "strong" consistency, not "eventual" - verified directly (see git
// history) that "eventual" reads in this SDK are served through the cached
// edge path with cache-control: max-age=0, stale-while-revalidate=60, so a
// read immediately following a write can silently return stale data for up
// to a minute. For a read-modify-write counter that's fatal, not a minor
// undercount: a burst of requests within that window all read the same
// stale (often "not found") value and each resets the counter to 1,
// so the limit never actually triggers. Strong reads cost a bit more
// latency but are the only way this primitive does what it says.

import { blobStore } from "./blobsFetch.js";

const STORE_NAME = "rate-limits";

function store() {
  return blobStore({ name: STORE_NAME, consistency: "strong" });
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
