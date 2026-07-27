import { Suspense } from "react";
import { GetStartedPage } from "@/components/miia/GetStartedPage";
import { SITE_URL, SITE_NAME } from "@/components/miia/site";

const TITLE = "Get started — Miia";
const DESCRIPTION =
  "Pick your plan, have a 10 minute chat, connect your channels. Miia is answering your enquiries within 48 hours.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/get-started" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/get-started",
    siteName: SITE_NAME,
    type: "website",
  },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GetStartedPage />
    </Suspense>
  );
}
