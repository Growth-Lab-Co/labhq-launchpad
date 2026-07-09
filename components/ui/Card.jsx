import styles from "./Card.module.css";

export default function Card({ padded = true, className = "", children, ...props }) {
  const cls = [styles.card, padded && styles.padded, className].filter(Boolean).join(" ");
  return (
    <div className={cls} {...props}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ title, action, className = "" }) {
  return (
    <div className={[styles.header, className].filter(Boolean).join(" ")}>
      <span className={styles.title}>{title}</span>
      {action}
    </div>
  );
};
