import { getTenant, ghlCredsFor } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { resolveLocationDataAuth, listConversations } from "@/lib/ghl";
import { ConversationsPageClient } from "@/components/dashboard/ConversationsPageClient";

async function getConversations(tenantSlug) {
  const tenant = await getTenant(tenantSlug);
  const deployments = await listDeployments(tenantSlug).catch(() => []);
  const deployment = deployments[0];
  if (!deployment?.locationId) return null;
  try {
    const legacyCreds = ghlCredsFor(tenant);
    const auth = await resolveLocationDataAuth({ tenantSlug, locationId: deployment.locationId, legacyCreds });
    if (!auth.token) return null;
    return await listConversations({ token: auth.token, locationId: deployment.locationId, limit: 50 });
  } catch {
    return null;
  }
}

export default async function ConversationsPage({ params }) {
  const conversations = await getConversations(params.tenant);
  return <ConversationsPageClient tenantSlug={params.tenant} conversations={conversations} />;
}
