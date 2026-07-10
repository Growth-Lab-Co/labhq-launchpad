// Bridges the two Mission Control auth paths: the classic per-tenant
// dashboard password (x-mc-key header, lib/mcAuth.js - operator override via
// MC_PASSWORD works here too) and a portal session cookie
// (lib/portalSession.js) for a self-serve agency signed into their own
// tenant. Tenant identity for the session path always comes from the
// session record itself, never from the caller-supplied `tenant` argument -
// a session for tenant A can never authorize an action against tenant B.
import { verifyPassword } from "./mcAuth.js";
import { resolvePortalSession } from "./portalSession.js";

export async function resolveMcAuth(req, tenant) {
  const key = req.headers.get("x-mc-key");
  if (key && (await verifyPassword(tenant, key))) return true;

  const session = await resolvePortalSession(req);
  if (session && session.tenantSlug === tenant) return true;

  return false;
}
