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
  const businessName = deployment?.businessName || tenant.name;

  return (
    <ChannelsPageClient
      tenantSlug={params.tenant}
      channels={channels}
      businessName={businessName}
      // Was healthcareMode-only, which meant a studio or salon (Momence,
      // Mindbody, Fresha - none of them clinics) could never see this
      // section at all, even though it's equally relevant to them. Now
      // shows for any clinic (healthcareMode, unchanged) OR any tenant who
      // told intake they use some booking/practice software at all
      // (practiceSoftware set to anything but "none" - see
      // app/api/deploy/route.js for how that's derived).
      showPracticeCards={Boolean(tenant.healthcareMode) || Boolean(tenant.practiceSoftware && tenant.practiceSoftware !== "none")}
      practiceSoftware={tenant.practiceSoftware || null}
      leadsieEmbedUrl={process.env.LEADSIE_EMBED_URL || ""}
    />
  );
}
