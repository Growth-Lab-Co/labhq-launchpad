import { getTenant } from "@/lib/tenants";
import { getBranding } from "@/lib/branding";

// A tenant's custom favicon (if set) fully replaces the site default here -
// Next.js merges segment-level metadata over the root layout's, rather than
// rendering both, so there's never a duplicate/conflicting <link rel="icon">.
export async function generateMetadata({ params }) {
  const tenant = getTenant(params.tenant);
  if (!tenant) return {};

  try {
    const { faviconUrl } = await getBranding(tenant.slug);
    return faviconUrl ? { icons: { icon: faviconUrl } } : {};
  } catch {
    // Branding is a nicety - never block the page on a Blobs hiccup.
    return {};
  }
}

// Wraps every page under /[tenant] (intake chat + Mission Control) so
// var(--accent) / var(--accent-soft) resolve to this tenant's brand colours
// everywhere. A saved Branding-page accent overrides the hardcoded default.
export default async function TenantLayout({ children, params }) {
  const tenant = getTenant(params.tenant);
  if (!tenant) return children;

  let accent = tenant.accent;
  try {
    const branding = await getBranding(tenant.slug);
    if (branding.accent) accent = branding.accent;
  } catch {
    // Branding is a nicety - never block the page on a Blobs hiccup.
  }

  return <div style={{ "--accent": accent, "--accent-soft": tenant.accentSoft }}>{children}</div>;
}
