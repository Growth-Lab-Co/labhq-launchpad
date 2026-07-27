import { SITE_URL, SITE_NAME } from "@/components/miia/site";
import styles from "@/components/miia/legal.module.css";

const TITLE = "Privacy policy — Miia";
const DESCRIPTION = "How Miia collects, uses and protects your data and your customers' data.";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/legal/privacy" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/legal/privacy", siteName: SITE_NAME, type: "website" },
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.h1}>Privacy policy</h1>
        <p className={styles.body}>
          Miia handles conversations, bookings and contact details on your behalf, and every deployment ships with
          AI disclosure, recording notices and opt-outs by default, in line with Australian Privacy Principles.
          Miia always identifies as an AI when asked. Your data is encrypted at rest, backed up daily, and
          exportable on request. We don&apos;t sell customer data. A full published policy is being finalised
          alongside our first customers, email us any time for the detail.
        </p>
        <p className={styles.updated}>Last updated 27 July 2026. Questions: hello@growthlabco.com.au</p>
      </div>
    </div>
  );
}
