import { getTenant, tenantProductType } from "@/lib/tenants";
import { getBranding } from "@/lib/branding";

// Every /[tenant] route (intake chat + dashboard) with no metadata of its
// own inherited the root layout's LabHQ title/favicon - fine for agency
// tenants (that IS their brand), wrong for Miia direct customers, who have
// no branding customisation feature and were falling through to it too.
const MIIA_ICONS = {
  icon: [
    { url: "/miia-icon-32.png", sizes: "32x32", type: "image/png" },
    { url: "/miia-icon-512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [{ url: "/miia-icon-180.png", sizes: "180x180", type: "image/png" }],
};

// A tenant's custom favicon (if set) fully replaces the site default here -
// Next.js merges segment-level metadata over the root layout's, rather than
// rendering both, so there's never a duplicate/conflicting <link rel="icon">.
export async function generateMetadata({ params }) {
  const tenant = await getTenant(params.tenant);
  if (!tenant) return {};

  if (tenantProductType(tenant) === "miia") {
    return {
      title: `Miia | ${tenant.name}`,
      icons: MIIA_ICONS,
      openGraph: { siteName: "Miia" },
    };
  }

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
  const tenant = await getTenant(params.tenant);
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
