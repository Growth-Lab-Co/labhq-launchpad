import styles from "./Marquee.module.css";

// Slow logo-free text marquee. Content is duplicated so the CSS-driven loop
// (translateX 0 to -50%) is seamless; prefers-reduced-motion freezes it via
// the global rule in tokens.css.
export function Marquee({ items }) {
  const row = items.join("   •   ");
  return (
    <div className={styles.marquee} aria-hidden="true">
      <div className={styles.track}>
        <span className={styles.item}>{row}   •   </span>
        <span className={styles.item}>{row}   •   </span>
      </div>
    </div>
  );
}
