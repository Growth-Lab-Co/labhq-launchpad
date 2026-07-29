import { SITE_URL } from "@/components/miia/site";
import { INDUSTRIES } from "@/components/miia/industries";

// Only the public Miia marketing routes — tenant, portal, admin and app
// routes are not meant to be indexed and stay out of this sitemap.
export default function sitemap() {
  // /get-started 301s to /pricing now (payment consolidated there) - not
  // worth an indexed sitemap entry for a permanent redirect.
  const routes = ["", "/meet-miia", "/features", "/how-it-works", "/pricing", "/legal/terms", "/legal/privacy"];
  const industryRoutes = INDUSTRIES.map((i) => i.path);
  return [...routes, ...industryRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
