import styles from "./ProgressBar.module.css";

export default function ProgressBar({ value, max = 1, className = "", "aria-label": ariaLabel }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={[styles.track, className].filter(Boolean).join(" ")}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={ariaLabel}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}
