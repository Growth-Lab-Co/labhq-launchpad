import Link from "next/link";
import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.top}>
          <span className={styles.logo}>miia</span>
          <p className={styles.tagline}>Your new front desk. Answers everything, sounds like you.</p>
        </div>

        <nav className={styles.links}>
          <Link href="/features" className={styles.link}>
            Features
          </Link>
          <Link href="/pricing" className={styles.link}>
            Pricing
          </Link>
          <Link href="/get-started" className={styles.link}>
            Get started
          </Link>
          <Link href="/legal/terms" className={styles.link}>
            Terms
          </Link>
          <Link href="/legal/privacy" className={styles.link}>
            Privacy
          </Link>
        </nav>

        <div className={styles.bottom}>
          <a href="https://growthlabco.com.au" target="_blank" rel="noopener noreferrer" className={styles.bottomLink}>
            A Growth Lab Co product
          </a>
          <span className={styles.sep}>·</span>
          <span>Australian built</span>
          <span className={styles.sep}>·</span>
          <a href="mailto:hello@growthlabco.com.au" className={styles.bottomLink}>
            hello@growthlabco.com.au
          </a>
        </div>
      </div>
    </footer>
  );
}
