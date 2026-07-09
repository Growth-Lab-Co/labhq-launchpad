import { useId } from "react";
import styles from "./Field.module.css";

export default function Input({ label, help, error, className = "", id, ...props }) {
  const autoId = useId();
  const fieldId = id || autoId;
  const cls = [styles.control, error && styles.invalid, className].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={fieldId}>
          {label}
        </label>
      )}
      <input id={fieldId} className={cls} aria-invalid={Boolean(error)} {...props} />
      {error ? <span className={styles.error}>{error}</span> : help ? <span className={styles.help}>{help}</span> : null}
    </div>
  );
}
