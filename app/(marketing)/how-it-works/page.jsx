import { HowItWorksPage } from "@/components/miia/HowItWorksPage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "How it works — Miia";
const DESCRIPTION =
  "How Miia goes from a 10 minute conversation to answering every enquiry on every channel, simply explained.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/how-it-works",
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function Page() {
  return <HowItWorksPage />;
}
