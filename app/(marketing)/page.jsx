import { HomePage } from "@/components/miia/HomePage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "Miia — your new front desk";
const DESCRIPTION =
  "Miia answers your website chat, socials, texts and phone. Trained on your business in one 10 minute conversation, live within 48 hours, answering day and night in your voice.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "79",
    priceCurrency: "AUD",
  },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <HomePage />
    </>
  );
}
