import LandingPage from "@/components/marketing/LandingPage";

const SITE_URL = "https://labhq.co";
const DESCRIPTION =
  "Your client has a 10 minute AI chat. LabHQ deploys their entire GHL account from your snapshot, then answers their leads with AI in their own voice on every connected channel. All white labelled under your brand.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "LabHQ | Client onboarding that does itself",
  description: DESCRIPTION,
  openGraph: {
    title: "LabHQ | Client onboarding that does itself",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "LabHQ",
    type: "website",
  },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LabHQ",
  description: DESCRIPTION,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "297",
    priceCurrency: "AUD",
  },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <LandingPage />
    </>
  );
}
