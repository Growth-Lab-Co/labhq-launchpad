import { MeetMiiaPage } from "@/components/miia/MeetMiiaPage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "Meet Miia — try her on your own website";
const DESCRIPTION = "Paste your website URL and chat with a live preview of Miia, trained on what she finds - no signup needed to start.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/meet-miia" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/meet-miia",
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function Page() {
  return <MeetMiiaPage />;
}
