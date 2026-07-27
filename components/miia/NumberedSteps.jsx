import { RevealStagger } from "./Reveal";
import styles from "./NumberedSteps.module.css";

export function NumberedSteps({ steps }) {
  return (
    <RevealStagger className={styles.grid} step={100}>
      {steps.map((step, i) => (
        <div className={styles.card} key={step.heading}>
          <div className={styles.num}>{String(i + 1).padStart(2, "0")}</div>
          <h3 className={styles.heading}>{step.heading}</h3>
          <p className={styles.body}>{step.body}</p>
        </div>
      ))}
    </RevealStagger>
  );
}
