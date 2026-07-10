// Full teardown of a self-serve tenant: the tenant record, its portal
// account, every Netlify Blobs store scoped to that tenant/account, and its
// {slug}.labhq.co Netlify domain alias (see lib/netlifyDomains.js). Called
// only from the MC_PASSWORD-gated admin "Remove tenant" flow
// (app/api/admin/tenants/[slug]/route.js) - never exposed to tenants
// themselves.
//
// SEED_TENANTS (growthlab, obm, demo) are refused outright, same protected
// list lib/tenants.js's deleteTenant already silently no-ops against - this
// throws instead, so the admin UI gets a clear rejection rather than a
// deletion that quietly did nothing.
//
// Each per-store cleanup is independently best-effort: one failed store
// (logged, tagged [REMOVE-TENANT]) doesn't abort the rest, because a
// half-removed tenant that blocks every subsequent step is worse than one
// orphaned blob an operator can clean up by hand later. The tenant record
// itself is deleted last, once everything else has at least been attempted,
// so the slug only frees up for reuse after real cleanup has run.

import { SEED_TENANTS, getTenant, deleteTenant } from "./tenants.js";
import { getAccountById, deleteAccount } from "./accounts.js";
import { destroyAllSessions } from "./portalSession.js";
import { deleteActivity } from "./activity.js";
import { restoreDefaultChecklistTemplate } from "./checklistTemplate.js";
import { deleteChecklistsForTenant } from "./checklist.js";
import { deleteBranding } from "./branding.js";
import { deleteMcAuth } from "./mcAuth.js";
import { deleteTeamMembers } from "./team.js";
import { deleteSnapshotTemplatesForTenant } from "./snapshotTemplates.js";
import { deleteNotificationSettings } from "./notifications.js";
import { deleteClaimLinksForTenant } from "./claimLinks.js";
import { deleteConnectionsForTenant } from "./ghlOAuth.js";
import { deleteDeploymentsForTenant } from "./deployments.js";
import { deletePasswordResetsForAccount } from "./passwordResets.js";
import { deregisterTenantDomainAlias } from "./netlifyDomains.js";
import { logAdminActivity } from "./adminActivity.js";

const TENANT_SCOPED_CLEANUPS = [
  ["activity", deleteActivity],
  ["checklistTemplate", restoreDefaultChecklistTemplate],
  ["checklists", deleteChecklistsForTenant],
  ["branding", deleteBranding],
  ["mcAuth", deleteMcAuth],
  ["teamMembers", deleteTeamMembers],
  ["snapshotTemplates", deleteSnapshotTemplatesForTenant],
  ["notifications", deleteNotificationSettings],
  ["claimLinks", deleteClaimLinksForTenant],
  ["ghlConnections", deleteConnectionsForTenant],
  ["deployments", deleteDeploymentsForTenant],
];

export async function removeTenant(slug) {
  const key = String(slug || "").trim().toLowerCase();
  if (SEED_TENANTS[key]) throw new Error(`${key} is a protected tenant and can't be removed`);

  const tenant = await getTenant(key);
  if (!tenant) throw new Error("Unknown tenant");

  const account = tenant.ownerAccountId ? await getAccountById(tenant.ownerAccountId) : null;

  if (account) {
    await destroyAllSessions(account.id).catch((e) =>
      console.error(`[REMOVE-TENANT] destroyAllSessions failed for ${key}:`, e.message)
    );
    await deletePasswordResetsForAccount(account.id).catch((e) =>
      console.error(`[REMOVE-TENANT] deletePasswordResetsForAccount failed for ${key}:`, e.message)
    );
    await deleteAccount(account.id).catch((e) =>
      console.error(`[REMOVE-TENANT] deleteAccount failed for ${key}:`, e.message)
    );
  }

  for (const [name, fn] of TENANT_SCOPED_CLEANUPS) {
    await fn(key).catch((e) => console.error(`[REMOVE-TENANT] ${name} cleanup failed for ${key}:`, e.message));
  }

  let domainDeregistered = false;
  try {
    const result = await deregisterTenantDomainAlias(key);
    domainDeregistered = result.wasRegistered;
  } catch (e) {
    console.error(`[REMOVE-TENANT] deregisterTenantDomainAlias failed for ${key}:`, e.status ?? "-", e.body ?? e.message);
  }

  await deleteTenant(key);

  await logAdminActivity({
    action: "tenant_removed",
    detail: { slug: key, accountId: account?.id || null, contactEmail: account?.contactEmail || null, domainDeregistered },
  });

  return { slug: key, domainDeregistered };
}
