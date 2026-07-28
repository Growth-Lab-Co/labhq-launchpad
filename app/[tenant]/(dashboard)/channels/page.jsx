import { getTenant } from "@/lib/tenants";
import { listDeployments } from "@/lib/deployments";
import { getSignupByTenantSlug } from "@/lib/miiaSignups";
import { getChannelsData } from "@/lib/dashboardData";
import { ChannelsPageClient } from "@/components/dashboard/ChannelsPageClient";

export default async function ChannelsPage({ params }) {
  const tenant = await getTenant(params.tenant);
  const deployments = await listDeployments(params.tenant).catch(() => []);
  const deployment = deployments[0] || null;
  const signup = await getSignupByTenantSlug(params.tenant).catch(() => null);
  const { channels } = await getChannelsData(tenant, deployment, signup);

  return <ChannelsPageClient tenantSlug={params.tenant} channels={channels} />;
}
