import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import Chat from "@/components/Chat";

export default function TenantPage({ params }) {
  const tenant = getTenant(params.tenant);
  if (!tenant) notFound();

  // Only pass safe, public fields to the client.
  const publicTenant = {
    slug: tenant.slug,
    name: tenant.name,
    assistantName: tenant.assistantName,
    logoText: tenant.logoText,
    logoUrl: tenant.logoUrl,
    accent: tenant.accent,
    welcome: tenant.welcome,
  };

  return <Chat tenant={publicTenant} />;
}
