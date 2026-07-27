"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./Reveal.module.css";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// Scroll-triggered fade + rise. delay in ms for staggering siblings.
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }) {
  const [ref, inView] = useInView();
  return (
    <Tag
      ref={ref}
      className={[styles.reveal, inView ? styles.revealVisible : "", className].filter(Boolean).join(" ")}
      style={{ transitionDelay: inView ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Tag>
  );
}

// Wraps a list of children and staggers each one's fade-up on scroll into view.
export function RevealStagger({ children, className = "", step = 90, as: Tag = "div" }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} className={className}>
      {children.map((child, i) => (
        <div
          key={i}
          className={[styles.reveal, inView ? styles.revealVisible : ""].join(" ")}
          style={{ transitionDelay: inView ? `${i * step}ms` : "0ms" }}
        >
          {child}
        </div>
      ))}
    </Tag>
  );
}

// Splits a headline into words that rise into place on load, staggered.
export function RiseWords({ text, className = "", startDelay = 0, step = 55 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className={styles.riseWordMask}>
          <span
            className={[styles.riseWord, mounted ? styles.riseWordVisible : ""].join(" ")}
            style={{ transitionDelay: `${startDelay + i * step}ms` }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

// Like RiseWords, but takes [{ text, accent }] parts so one or two words in
// a headline can carry the violet accent class while the rest stay ink.
export function RiseHeadline({ parts, className = "", accentClassName = "", startDelay = 0, step = 55 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const words = [];
  parts.forEach((part) => {
    part.text.split(" ").forEach((w) => words.push({ word: w, accent: part.accent }));
  });

  return (
    <span className={className}>
      {words.map((item, i) => (
        <span key={i} className={styles.riseWordMask}>
          <span
            className={[styles.riseWord, mounted ? styles.riseWordVisible : "", item.accent ? accentClassName : ""].join(" ")}
            style={{ transitionDelay: `${startDelay + i * step}ms` }}
          >
            {item.word}
            {i < words.length - 1 ? " " : ""}
          </span>
        </span>
      ))}
    </span>
  );
}

export function useCountUp(target, { duration = 1200, inView, decimals = 0 } = {}) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }

    let raf;
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
}

export { useInView };
