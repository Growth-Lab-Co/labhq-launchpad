import { getTenant, ghlCredsFor, ensureWidgetKey } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { resolveLocationDataAuth, listConversations } from "@/lib/ghl";
import { listWidgetConversationsForTenant } from "@/lib/widgetConversations";
import { ConversationsPageClient } from "@/components/dashboard/ConversationsPageClient";

// Merges GHL-channel conversations (SMS/FB/IG, via the location's own data
// auth) with in-house widget conversations (lib/widgetConversations.js) into
// one list, newest first - job 1's "Conversations page shows widget
// conversations unified alongside GHL-channel ones". `null` only when
// NEITHER source has anything to show (the existing "couldn't check" empty
// state) - a working GHL check returning zero conversations still merges
// cleanly with real widget history sitting right here locally.
async function getConversations(tenantSlug, tenant) {
  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];

  let ghlConversations = null;
  if (deployment?.locationId) {
    try {
      const legacyCreds = ghlCredsFor(tenant);
      const auth = await resolveLocationDataAuth({ tenantSlug, locationId: deployment.locationId, legacyCreds });
      if (auth.token) {
        ghlConversations = await listConversations({ token: auth.token, locationId: deployment.locationId, limit: 50 });
      }
    } catch {
      // Leave ghlConversations null - "couldn't check", not "zero".
    }
  }

  const widgetConversations = await listWidgetConversationsForTenant(tenantSlug).catch(() => []);
  const normalizedWidget = widgetConversations.map((c) => {
    // The visitor's own first message, not whichever message happens to be
    // last (often Miia's own reply, or briefly a still-pending placeholder
    // - see lib/widgetConversations.js) - this is what actually tells two
    // rows apart at a glance, since every row's name is the same generic
    // "Website visitor".
    const firstInbound = c.messages.find((m) => m.direction === "inbound");
    return {
      id: c.id,
      source: "widget",
      contactName: c.contactEmail || "Website visitor",
      lastMessageBody: firstInbound?.body || c.messages[c.messages.length - 1]?.body || "",
      dateUpdated: c.updatedAt,
    };
  });

  if (ghlConversations === null && normalizedWidget.length === 0) return null;

  const normalizedGhl = (ghlConversations || []).map((c) => ({ ...c, source: "ghl" }));
  return [...normalizedGhl, ...normalizedWidget].sort((a, b) => new Date(b.dateUpdated) - new Date(a.dateUpdated));
}

export default async function ConversationsPage({ params }) {
  const tenant = await ensureWidgetKey(await getTenant(params.tenant));
  const conversations = await getConversations(params.tenant, tenant);
  return <ConversationsPageClient tenantSlug={params.tenant} widgetKey={tenant?.widgetKey} conversations={conversations} />;
}
