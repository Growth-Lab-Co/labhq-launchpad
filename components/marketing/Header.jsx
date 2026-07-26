"use client";
import { useEffect, useState } from "react";
import { VIDEO_URL } from "./constants";
import styles from "./landing.module.css";

// Transparent over the dark hero; picks up a Midnight Base background and a
// hairline border once the page scrolls past it, per the design brief.
export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
      <div className={styles.container}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>LabHQ</span>
          <div className={styles.headerRight}>
            <a href="/demo" className={styles.headerLink}>
              Live demo
            </a>
            <a
              href={VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm} ${styles.headerCta}`}
            >
              Watch the 90 second demo
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
