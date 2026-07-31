import { listDeployments } from "@/lib/deployments";
import { SettingsPageClient } from "@/components/dashboard/SettingsPageClient";

export default async function SettingsPage({ params }) {
  const deployments = await listDeployments(params.tenant).catch(() => []);
  const customValues = deployments[0]?.customValues || {};

  return <SettingsPageClient tenantSlug={params.tenant} customValues={customValues} />;
}
