import { PricingPage } from "@/components/miia/PricingPage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "Pricing — Miia";
const DESCRIPTION =
  "Simple monthly pricing with no lock-in. Founding members get 20% off for life. Miia Chat from $79/mo, Miia Everywhere from $199/mo, Miia Complete from $319/mo.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/pricing",
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function Page() {
  return <PricingPage />;
}
