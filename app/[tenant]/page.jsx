import { notFound } from "next/navigation";
import { getPublicTenant } from "@/lib/tenants";
import { getBranding } from "@/lib/branding";
import Chat from "@/components/Chat";

export default async function TenantPage({ params }) {
  const tenant = await getPublicTenant(params.tenant);
  if (!tenant) notFound();

  let logoUrl = tenant.logoUrl;
  try {
    const branding = await getBranding(tenant.slug);
    if (branding.logoUrl) logoUrl = branding.logoUrl;
  } catch {
    // Branding is a nicety - never block the page on a Blobs hiccup.
  }

  // Only pass safe, public fields to the client.
  const publicTenant = {
    slug: tenant.slug,
    name: tenant.name,
    assistantName: tenant.assistantName,
    logoText: tenant.logoText,
    logoUrl,
    accent: tenant.accent,
    welcome: tenant.welcome,
    product: tenant.product || null,
    deployedAt: tenant.deployedAt || null,
  };

  return <Chat tenant={publicTenant} />;
}
