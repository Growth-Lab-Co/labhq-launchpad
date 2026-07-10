// Portal session auth: an opaque random token is the only thing in the
// cookie. The token maps to a session record in Netlify Blobs, so logout /
// "log out everywhere" / password-change invalidation are plain deletes -
// no self-encoding token to revoke around (see plan decision 1).

import { blobStore } from "./blobsFetch.js";
import { randomUUID } from "crypto";

const SESSIONS_STORE = "portal-sessions";
const ACCOUNT_SESSIONS_STORE = "account-sessions";
export const SESSION_COOKIE = "labhq_portal_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_SESSIONS_PER_ACCOUNT = 5;

function sessionsStore() {
  return blobStore({ name: SESSIONS_STORE, consistency: "strong" });
}

function accountSessionsStore() {
  return blobStore({ name: ACCOUNT_SESSIONS_STORE, consistency: "strong" });
}

export async function createSession({ accountId, tenantSlug }) {
  const token = randomUUID() + randomUUID();
  const now = Date.now();
  const record = { accountId, tenantSlug, createdAt: now, expiresAt: now + SESSION_TTL_MS };
  await sessionsStore().setJSON(token, record);

  const tokens = (await accountSessionsStore().get(accountId, { type: "json" })) || [];
  const next = [token, ...tokens].slice(0, MAX_SESSIONS_PER_ACCOUNT);
  const evicted = tokens.length >= MAX_SESSIONS_PER_ACCOUNT ? tokens.slice(MAX_SESSIONS_PER_ACCOUNT - 1) : [];
  await accountSessionsStore().setJSON(accountId, next);
  await Promise.all(evicted.map((t) => sessionsStore().delete(t).catch(() => {})));

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
  const record = await sessionsStore().get(token, { type: "json" });
  await sessionsStore().delete(token).catch(() => {});
  if (record?.accountId) {
    const tokens = (await accountSessionsStore().get(record.accountId, { type: "json" })) || [];
    await accountSessionsStore().setJSON(record.accountId, tokens.filter((t) => t !== token));
  }
}

// Logout-everywhere / password-change invalidation - a bounded delete since
// each account has at most MAX_SESSIONS_PER_ACCOUNT tokens.
export async function destroyAllSessions(accountId) {
  const tokens = (await accountSessionsStore().get(accountId, { type: "json" })) || [];
  await Promise.all(tokens.map((t) => sessionsStore().delete(t).catch(() => {})));
  await accountSessionsStore().delete(accountId).catch(() => {});
}

// The session needs to be readable both at the root domain (labhq.co/portal)
// and at a tenant's own subdomain (<slug>.labhq.co/missioncontrol) so the
// existing per-tenant Mission Control UI can recognise a signed-in portal
// account without a separate login - a plain host-only cookie set on
// labhq.co would never be sent to a *.labhq.co subdomain. In local dev
// (localhost) there's no shared parent domain to set, so the cookie falls
// back to host-only there, which is fine since dev testing stays same-host.
export function cookieDomainForRequest(req) {
  const host = (req.headers.get("host") || "").split(":")[0];
  if (host === "labhq.co" || host.endsWith(".labhq.co")) return ".labhq.co";
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

// Resolves the authenticated account + tenant for a portal request, or null.
export async function resolvePortalSession(req) {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  return { token, ...session };
}
