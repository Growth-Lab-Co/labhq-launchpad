import { useId } from "react";
import styles from "./Field.module.css";

export default function Select({ label, help, error, className = "", id, children, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const cls = [styles.control, styles.select, error && styles.invalid, className].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
      )}
      <div className={styles.selectWrap}>
        <select id={fieldId} className={cls} aria-invalid={Boolean(error)} {...props}>
          {children}
        </select>
      </div>
      {error ? <span className={styles.error}>{error}</span> : help ? <span className={styles.help}>{help}</span> : null}
    </div>
  );
}
