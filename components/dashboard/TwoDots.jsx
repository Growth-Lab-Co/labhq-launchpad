import styles from "./TwoDots.module.css";

// The two-dot motif - used in exactly three places across the dashboard:
// the sidebar wordmark, the sidebar's "Miia is live" status card, and the
// conversation hero's typing indicator. Don't add a fourth.
export function TwoDots({ size = "md", pulse = false, className = "" }) {
  return (
    <span className={[styles.box, styles[size], className].filter(Boolean).join(" ")} aria-hidden="true">
      <span className={[styles.dot, pulse ? styles.pulse : ""].filter(Boolean).join(" ")} style={pulse ? { animationDelay: "0ms" } : undefined} />
      <span className={[styles.dot, pulse ? styles.pulse : ""].filter(Boolean).join(" ")} style={pulse ? { animationDelay: "220ms" } : undefined} />
    </span>
  );
}
