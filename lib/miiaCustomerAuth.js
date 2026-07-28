// Miia customer dashboard auth: magic link in, opaque session cookie after.
// Deliberately the same shape as lib/portalSession.js (separate Blobs store,
// separate cookie name, same TTL/rotation approach) - the "boring, standard"
// choice, not a new pattern. Two token types:
//   - magic link token: short-lived (30 min), single-use, emailed to the
//     customer, exchanged for a session at /api/miia/auth/verify.
//   - session token: 30-day cookie, the same one both the welcome-email
//     click and a normal return visit end up holding.

import { blobStore } from "./blobsFetch.js";
import { randomUUID } from "crypto";

const SESSIONS_STORE = "miia-customer-sessions";
const MAGIC_LINKS_STORE = "miia-customer-magic-links";
export const SESSION_COOKIE = "miia_customer_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAGIC_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes, the default for a requested return-visit link

function sessionsStore() {
  return blobStore({ name: SESSIONS_STORE, consistency: "strong" });
}
function magicLinksStore() {
  return blobStore({ name: MAGIC_LINKS_STORE, consistency: "strong" });
}

export async function createSession({ tenantSlug }) {
  const token = randomUUID() + randomUUID();
  const now = Date.now();
  const record = { tenantSlug, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  await sessionsStore().setJSON(token, record);
  return { token, expiresAt: record.expiresAt };
}

export async function getSession(token) {
  if (!token) return null;
  const record = await sessionsStore().get(token, { type: "json" });
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    await sessionsStore().delete(token).catch(() => {});
    return null;
  }
  return record;
}

export async function destroySession(token) {
  if (!token) return;
  await sessionsStore().delete(token).catch(() => {});
}

// Single-use: consumeMagicLink deletes the token the moment it's read,
// whether or not the caller goes on to create a session - a link can only
// ever authenticate once.
export async function createMagicLink({ tenantSlug, ttlMs = MAGIC_LINK_TTL_MS }) {
  const token = randomUUID() + randomUUID();
  const now = Date.now();
  await magicLinksStore().setJSON(token, { tenantSlug, expiresAt: now + ttlMs });
  return token;
}

export async function consumeMagicLink(token) {
  if (!token) return null;
  const record = await magicLinksStore().get(token, { type: "json" });
  await magicLinksStore().delete(token).catch(() => {});
  if (!record) return null;
  if (record.expiresAt < Date.now()) return null;
  return { tenantSlug: record.tenantSlug };
}

// Same cross-subdomain reasoning as lib/portalSession.js's
// cookieDomainForRequest - meetmiia.com is the customer-facing domain, so
// the cookie needs to work at both meetmiia.com and any future
// <slug>.meetmiia.com. Falls back to host-only outside that domain (local
// dev, labhq.co).
export function cookieDomainForRequest(req) {
  const host = (req.headers.get("host") || "").split(":")[0];
  if (host === "meetmiia.com" || host.endsWith(".meetmiia.com")) return ".meetmiia.com";
  return undefined;
}

export function setSessionCookie(response, token, expiresAt, domain) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    domain,
    expires: new Date(expiresAt),
  });
  return response;
}

export function clearSessionCookie(response, domain) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", domain, maxAge: 0 });
  return response;
}

export function getTokenFromRequest(req) {
  return req.cookies.get(SESSION_COOKIE)?.value || null;
}

// Resolves the authenticated tenantSlug for a dashboard request, or null.
// `tenantSlug` is passed in so a session cookie can never authenticate a
// DIFFERENT tenant's dashboard than the one it was issued for.
export async function resolveCustomerSession(req, tenantSlug) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const session = await getSession(token);
  if (!session || session.tenantSlug !== tenantSlug) return null;
  return { token, ...session };
}
