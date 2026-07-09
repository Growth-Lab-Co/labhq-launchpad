import styles from "./Tabs.module.css";

export default function Tabs({ items, value, onChange, className = "" }) {
  return (
    <div className={[styles.list, className].filter(Boolean).join(" ")} role="tablist">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={item.value === value}
          className={[styles.tab, item.value === value && styles.active].filter(Boolean).join(" ")}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
