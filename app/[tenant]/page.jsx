import { notFound } from "next/navigation";
import { getPublicTenant, tenantProductType } from "@/lib/tenants";
import { getBranding } from "@/lib/branding";
import Chat from "@/components/Chat";
import { resolveDashboardAccess } from "@/lib/dashboardAccess";
import { getDashboardHomeData, getChannelsData } from "@/lib/dashboardData";
import { getSignupByTenantSlug } from "@/lib/miiaSignups";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { SignInGate } from "@/components/dashboard/SignInGate";
import "@/components/dashboard/tokens.css";

export default async function TenantPage({ params }) {
  const tenant = await getPublicTenant(params.tenant);
  if (!tenant) notFound();

  // Miia customers, once deployed, get the new dashboard at this same URL
  // instead of Chat.jsx's "locked" phase - agency tenants (product Type
  // "agency", the default) are completely unaffected, still Chat.jsx end to
  // end. See lib/tenants.js tenantProductType() - the only place this
  // decision should ever be made.
  if (tenantProductType(tenant) === "miia" && tenant.deployedAt) {
    return <MiiaDashboardHome slug={params.tenant} />;
  }

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

async function MiiaDashboardHome({ slug }) {
  const access = await resolveDashboardAccess(slug);
  if (access.status === "not-found") notFound();
  if (access.status === "not-dashboard") notFound(); // shouldn't happen - guarded above
  if (access.status === "needs-auth") {
    return <SignInGate tenantSlug={slug} businessName={access.tenant.name} />;
  }

  const { tenant, deployment } = access;
  const signup = await getSignupByTenantSlug(slug).catch(() => null);
  const [data, channelsData] = await Promise.all([
    getDashboardHomeData(tenant, deployment, signup),
    getChannelsData(tenant, deployment, signup),
  ]);

  const base = `/${slug}`;
  // Prefer the signup record (captured from Stripe checkout at payment time)
  // over the deployment/intake record: the intake interview's own
  // business_name/contact_name answers can end up swapped or otherwise
  // corrupted by the known field-splitting issue (one real customer's own
  // answers had "business name" and "contact name" reversed) - the signup's
  // fields were captured independently, before the interview even started,
  // and are never subject to that failure mode.
  const businessName = signup?.businessName || deployment?.businessName || tenant.name;
  const contactName = signup?.contactName || deployment?.contactName || "";
  const contactFirstName = contactName.trim().split(/\s+/)[0] || null;
  // Account chip's second line: contact name, falling back to their email
  // (never the business name again - that's line one) if no name is on file.
  const contactDisplay = contactName.trim() || signup?.email || "";

  return (
    <DashboardShell base={base} tenant={{ ...tenant, contactName: contactDisplay }} businessName={businessName}>
      <DashboardHome
        tenant={tenant}
        deployment={deployment}
        businessName={businessName}
        contactFirstName={contactFirstName}
        data={data}
        channelsData={channelsData}
        base={base}
      />
    </DashboardShell>
  );
}
