"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import styles from "./Header.module.css";

const NAV = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/allied-health", label: "For clinics" },
  { href: "/pricing", label: "Pricing" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={[styles.header, scrolled ? styles.headerScrolled : ""].join(" ")}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo} aria-label="Miia home">
          <Image src="/miia-wordmark-ink.png" alt="Miia" width={856} height={496} priority className={styles.logoImg} />
        </Link>

        <nav className={styles.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.right}>
          <Button href="/pricing" size="sm" className={styles.desktopCta}>
            {PRIMARY_CTA_LABEL}
          </Button>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className={styles.mobileMenu}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Button href="/pricing" className={styles.mobileCta}>
            {PRIMARY_CTA_LABEL}
          </Button>
        </div>
      )}
    </header>
  );
}
