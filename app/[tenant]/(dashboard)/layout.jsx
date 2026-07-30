import { notFound } from "next/navigation";
import { resolveDashboardAccess, resolveDisplayIdentity } from "@/lib/dashboardAccess";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SignInGate } from "@/components/dashboard/SignInGate";
import "@/components/dashboard/tokens.css";

// Shared gate for every dashboard sub-page (/conversations, /bookings,
// /channels, /billing, /help) - the tenant root's own dashboard branch
// (app/[tenant]/page.jsx) duplicates this check rather than living under
// this same layout, since it also has to serve Chat.jsx for every other
// case (not deployed yet, or an agency tenant) at that exact URL.
export default async function DashboardLayout({ children, params }) {
  const access = await resolveDashboardAccess(params.tenant);
  if (access.status === "not-found" || access.status === "not-dashboard") notFound();
  if (access.status === "needs-auth") {
    return <SignInGate tenantSlug={params.tenant} businessName={access.tenant.name} />;
  }

  const { tenant, deployment } = access;
  const base = `/${params.tenant}`;
  const { businessName, contactDisplay } = await resolveDisplayIdentity(params.tenant, tenant, deployment);

  return (
    <DashboardShell base={base} tenant={{ ...tenant, contactName: contactDisplay }} businessName={businessName}>
      {children}
    </DashboardShell>
  );
}
