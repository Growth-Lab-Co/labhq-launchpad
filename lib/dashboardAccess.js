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
import { getSignupByTenantSlug } from "./miiaSignups.js";

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

// Prefer the signup record (captured from Stripe checkout at payment time)
// over the deployment/intake record: the intake interview's own
// business_name/contact_name answers can end up swapped or otherwise
// corrupted by the known field-splitting issue (one real customer's own
// answers had "business name" and "contact name" reversed) - the signup's
// fields were captured independently, before the interview even started,
// and are never subject to that failure mode. Both dashboard entry points
// (app/[tenant]/page.jsx's own branch and the shared sub-page layout) need
// the exact same resolution, so it lives here rather than duplicated in
// each - found 2026-07-30 that the layout had its own unfixed copy, so the
// account chip still showed the corrupted name on every page except the
// dashboard home.
export async function resolveDisplayIdentity(slug, tenant, deployment) {
  const signup = await getSignupByTenantSlug(slug).catch(() => null);
  const businessName = signup?.businessName || deployment?.businessName || tenant.name;
  const contactName = (signup?.contactName || deployment?.contactName || "").trim();
  const contactFirstName = contactName.split(/\s+/)[0] || null;
  // Account chip's second line: contact name, falling back to their email
  // (never the business name again - that's line one) if no name is on file.
  const contactDisplay = contactName || signup?.email || "";
  return { signup, businessName, contactName, contactFirstName, contactDisplay };
}
