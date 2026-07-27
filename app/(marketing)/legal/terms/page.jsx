import { SITE_URL, SITE_NAME } from "@/components/miia/site";
import styles from "@/components/miia/legal.module.css";

const TITLE = "Terms of service — Miia";
const DESCRIPTION = "The terms of service for using Miia.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/legal/terms" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/legal/terms", siteName: SITE_NAME, type: "website" },
};

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.h1}>Terms of service</h1>
        <p className={styles.body}>
          Miia is a Growth Lab Co product. Founding members are covered by the plan terms sent with their setup
          email: no lock-in, cancel any time from your dashboard, and the 30 day guarantee described on our{" "}
          <a href="/pricing">pricing page</a>. Full published terms are being finalised alongside our first
          customers, if anything here isn&apos;t clear, email us and we&apos;ll sort it out directly.
        </p>
        <p className={styles.updated}>Last updated 27 July 2026. Questions: hello@growthlabco.com.au</p>
      </div>
    </div>
  );
}
