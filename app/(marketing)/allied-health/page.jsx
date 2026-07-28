import { AlliedHealthPage, ALLIED_HEALTH_FAQ } from "@/components/miia/AlliedHealthPage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "Miia for allied health and clinics: AI front desk for practices";
const DESCRIPTION =
  "Miia answers new patient enquiries, books appointments and hands anything clinical straight to your team, day and night. Live within 48 hours.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/allied-health" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/allied-health",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: ALLIED_HEALTH_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <AlliedHealthPage />
    </>
  );
}
