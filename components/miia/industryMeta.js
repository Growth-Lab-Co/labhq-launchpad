import { SITE_URL, SITE_NAME } from "./site";

// Shared metadata + FAQPage JSON-LD builder for the six /miia-for-x pages,
// so each route file is just a few lines instead of duplicating the same
// OG/canonical boilerplate six times.
export function buildIndustryMetadata(industry) {
  return {
    metadataBase: new URL(SITE_URL),
    title: industry.seoTitle,
    description: industry.seoDescription,
    alternates: { canonical: industry.path },
    openGraph: {
      title: industry.seoTitle,
      description: industry.seoDescription,
      url: industry.path,
      siteName: SITE_NAME,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: industry.seoTitle,
      description: industry.seoDescription,
    },
  };
}

export function buildIndustryFaqJsonLd(industry) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: industry.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
