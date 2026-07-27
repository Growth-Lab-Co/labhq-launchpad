import { FeaturesPage } from "@/components/miia/FeaturesPage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "Features — Miia";
const DESCRIPTION =
  "Everything Miia does: answers every channel, trained by conversation, books real jobs, knows when to hand over, answers the phone, and keeps you in control.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/features" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/features",
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function Page() {
  return <FeaturesPage />;
}
