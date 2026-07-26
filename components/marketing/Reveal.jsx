"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./landing.module.css";

// The page's one restrained scroll animation: a section fades and lifts 12px
// into place the first time it enters view. Skipped entirely under
// prefers-reduced-motion - no observer is even attached, the content is just
// shown immediately.
export function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={[styles.reveal, visible ? styles.revealVisible : "", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
