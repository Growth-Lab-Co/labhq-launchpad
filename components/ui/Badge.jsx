import styles from "./Badge.module.css";

const TONES = ["neutral", "accent", "success", "warning", "danger"];

export default function Badge({ tone = "neutral", dot = true, className = "", children }) {
  const cls = [styles.badge, styles[TONES.includes(tone) ? tone : "neutral"], className].filter(Boolean).join(" ");
  return (
    <span className={cls}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
