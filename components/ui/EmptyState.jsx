import styles from "./EmptyState.module.css";

export default function EmptyState({ title, description, action }) {
  return (
    <div className={styles.empty}>
      {title && <div className={styles.title}>{title}</div>}
      {description && <div className={styles.description}>{description}</div>}
      {action}
    </div>
  );
}
