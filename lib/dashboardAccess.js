// Shared gate for every Miia customer-dashboard route (the tenant root once
// deployed, plus /conversations, /bookings, /channels, /billing, /help).
// Server-only (reads the httpOnly session cookie via next/headers) - both
// app/[tenant]/page.jsx's dashboard branch and
// app/[tenant]/(dashboard)/layout.jsx call this so the auth/productType
// logic exists in exactly one place.

import { cookies } from "next/headers";
import { getPublicTenant, tenantProductType, ensureWidgetKey } from "./tenants.js";
import { listDeployments } from "./deployments.js";
import { getSession, SESSION_COOKIE } from "./miiaCustomerAuth.js";

// Returns one of:
//   { status: "not-found" }                       - unknown tenant
//   { status: "not-dashboard" }                    - agency tenant, or a
//                                                     miia tenant that
//                                                     hasn't deployed yet
//                                                     (still on intake)
//   { status: "needs-auth", tenant }                - miia + deployed, no
//                                                     valid session
//   { status: "ok", tenant, deployment }            - authenticated
export async function resolveDashboardAccess(slug) {
  // getPublicTenant (not getTenant) so an archived tenant 404s here exactly
  // like it does at the plain intake/chat URL - no dashboard sub-page
  // should be reachable for a tenant the rest of the app treats as gone.
  const tenant = await getPublicTenant(slug);
  if (!tenant) return { status: "not-found" };

  if (tenantProductType(tenant) !== "miia" || !tenant.deployedAt) {
    return { status: "not-dashboard" };
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(token) : null;
  if (!session || session.tenantSlug !== slug) {
    return { status: "needs-auth", tenant };
  }

  const deployments = await listDeployments(slug).catch(() => []);
  const deployment = deployments[0] || null;

  // Every dashboard render goes through here (this file's own header
  // comment) - centralising the widget-key backfill in one place means
  // every page that needs it (TestChat, the Channels embed card) can just
  // read tenant.widgetKey rather than each calling ensureWidgetKey itself.
  const withWidgetKey = await ensureWidgetKey(tenant);

  return { status: "ok", tenant: withWidgetKey, deployment };
}
