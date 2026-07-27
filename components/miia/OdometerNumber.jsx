"use client";
import styles from "./OdometerNumber.module.css";

function Digit({ digit, active, delay }) {
  return (
    <span className={styles.digitWindow}>
      <span
        className={styles.digitReel}
        style={{
          // Percentages in transform: translateY() resolve against the
          // reel's OWN height (10 stacked cells), so one cell = 10%, not
          // 100% — 100% would overshoot a full reel-height per digit.
          transform: `translateY(-${(active ? digit : 0) * 10}%)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        {Array.from({ length: 10 }).map((_, n) => (
          <span key={n} className={styles.digitCell}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

// Odometer-style rolling digits: each digit is a 0-9 reel that scrolls up
// into place when `inView` flips true, staggered digit by digit. Under
// prefers-reduced-motion the transition-duration collapses to ~0 globally
// (see tokens.css), so this still lands on the right number instantly.
export function OdometerNumber({ value, inView, digitDelay = 70, className = "" }) {
  const chars = String(value).split("");
  return (
    <span className={[styles.wrap, className].filter(Boolean).join(" ")}>
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <Digit key={i} digit={Number(ch)} active={inView} delay={i * digitDelay} />
        ) : (
          <span key={i} className={styles.literal}>
            {ch}
          </span>
        )
      )}
    </span>
  );
}
