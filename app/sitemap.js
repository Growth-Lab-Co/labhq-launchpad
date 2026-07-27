import { SITE_URL } from "@/components/miia/site";

// Only the public Miia marketing routes — tenant, portal, admin and app
// routes are not meant to be indexed and stay out of this sitemap.
export default function sitemap() {
  const routes = ["", "/features", "/pricing", "/get-started", "/legal/terms", "/legal/privacy"];
  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
  }));
}
