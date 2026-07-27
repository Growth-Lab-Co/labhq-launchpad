import { SITE_URL } from "@/components/miia/site";
import { INDUSTRIES } from "@/components/miia/industries";

// Only the public Miia marketing routes — tenant, portal, admin and app
// routes are not meant to be indexed and stay out of this sitemap.
export default function sitemap() {
  const routes = ["", "/features", "/how-it-works", "/pricing", "/get-started", "/legal/terms", "/legal/privacy"];
  const industryRoutes = INDUSTRIES.map((i) => i.path);
  return [...routes, ...industryRoutes].map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
