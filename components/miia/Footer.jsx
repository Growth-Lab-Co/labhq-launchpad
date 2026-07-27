"use client";
import Link from "next/link";
import Image from "next/image";
import { ArrowUp } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import styles from "./Footer.module.css";

const MARQUEE_ITEMS = ["Miia", "AI front desk", "Answers everything", "Sounds like you", "Australian built"];

const PILLS = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
];

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function Footer() {
  const year = new Date().getFullYear();
  const marqueeRow = MARQUEE_ITEMS.join(" · ");

  return (
    <footer className={styles.footer}>
      <div className={styles.giant} aria-hidden="true">
        miia
      </div>

      <div className={styles.marquee} aria-hidden="true">
        <div className={styles.marqueeTrack}>
          <span className={styles.marqueeItem}>{marqueeRow} · </span>
          <span className={styles.marqueeItem}>{marqueeRow} · </span>
        </div>
      </div>

      <div className={styles.center}>
        <h2 className={styles.heading}>Ready for your new front desk?</h2>
        <p className={styles.sub}>Be one of the first 20 founding members. 20% off, locked in for life.</p>
        <Button href="/get-started" size="lg" className={styles.bigCta}>
          {PRIMARY_CTA_LABEL}
        </Button>
        <nav className={styles.pills}>
          {PILLS.map((p) => (
            <Link key={p.href} href={p.href} className={styles.pill}>
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className={styles.bottom}>
        <div className={styles.brand}>
          <Image
            src="/miia-wordmark-ink.png"
            alt="Miia"
            width={856}
            height={496}
            className={styles.brandImg}
          />
          <span className={styles.brandName}>A Growth Lab Co product</span>
        </div>
        <p className={styles.copy}>
          © {year} Miia · Australian built · <a href="mailto:hello@growthlabco.com.au">hello@growthlabco.com.au</a>
        </p>
        <button type="button" className={styles.backTop} onClick={scrollToTop} aria-label="Back to top">
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      </div>
    </footer>
  );
}
