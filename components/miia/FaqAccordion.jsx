"use client";
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import styles from "./FaqAccordion.module.css";

function FaqItem({ q, a, open, onToggle }) {
  const panelRef = useRef(null);
  return (
    <div className={styles.item}>
      <button type="button" className={styles.question} onClick={onToggle} aria-expanded={open}>
        <span>{q}</span>
        <Plus size={20} strokeWidth={2.5} className={[styles.icon, open ? styles.iconOpen : ""].join(" ")} />
      </button>
      <div
        ref={panelRef}
        className={styles.panelWrap}
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className={styles.panelInner}>
          <p className={styles.answer}>{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className={styles.list}>
      {items.map((item, i) => (
        <FaqItem
          key={item.q}
          q={item.q}
          a={item.a}
          open={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
        />
      ))}
    </div>
  );
}
