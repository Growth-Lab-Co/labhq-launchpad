"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import { PLANS, yearlyPerMonth } from "./plans";
import styles from "./PricingCards.module.css";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

function useRollingNumber(value) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    function tick(now) {
      const t = Math.min(1, (now - start) / 420);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setDisplay(value);
        fromRef.current = value;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return Math.round(display);
}

export function PricingToggle({ yearly, onChange }) {
  return (
    <div className={styles.toggleWrap}>
      <span className={!yearly ? styles.toggleLabelActive : styles.toggleLabel}>Monthly</span>
      <button
        type="button"
        className={styles.toggle}
        role="switch"
        aria-checked={yearly}
        onClick={() => onChange(!yearly)}
      >
        <span className={[styles.toggleKnob, yearly ? styles.toggleKnobYearly : ""].join(" ")} />
      </button>
      <span className={yearly ? styles.toggleLabelActive : styles.toggleLabel}>
        Yearly <span className={styles.toggleBadge}>2 months free</span>
      </span>
    </div>
  );
}

function PriceTag({ plan, yearly }) {
  const founding = yearly ? yearlyPerMonth(plan.foundingPrice) : plan.foundingPrice;
  const standard = yearly ? yearlyPerMonth(plan.price) : plan.price;
  const foundingDisplay = useRollingNumber(founding);
  const standardDisplay = useRollingNumber(standard);

  return (
    <div className={styles.priceRow}>
      <span className={styles.priceStandard}>${standardDisplay}</span>
      <span className={styles.priceFounding}>
        ${foundingDisplay}
        <span className={styles.pricePer}>/mo{yearly ? ", billed yearly" : ""}</span>
      </span>
    </div>
  );
}

export function PricingCards({ selectedId, onSelect }) {
  const [yearly, setYearly] = useState(false);

  return (
    <div>
      <div className={styles.toggleRow}>
        <PricingToggle yearly={yearly} onChange={setYearly} />
      </div>

      <div className={styles.grid}>
        {PLANS.map((plan) => {
          const selectable = typeof onSelect === "function";
          const isSelected = selectedId === plan.id;
          const Wrapper = selectable ? "button" : "div";
          return (
            <Wrapper
              key={plan.id}
              type={selectable ? "button" : undefined}
              onClick={selectable ? () => onSelect(plan.id) : undefined}
              className={[
                styles.card,
                plan.popular ? styles.cardPopular : "",
                isSelected ? styles.cardSelected : "",
              ].join(" ")}
            >
              {plan.popular && <span className={styles.badge}>Most popular</span>}
              <h3 className={styles.name}>{plan.name}</h3>
              <p className={styles.tagline}>{plan.tagline}</p>

              <PriceTag plan={plan} yearly={yearly} />

              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} strokeWidth={2.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!selectable && (
                <Button
                  href={`/get-started?plan=${plan.id}`}
                  variant={plan.popular ? "primary" : "outline"}
                  className={styles.cta}
                >
                  {PRIMARY_CTA_LABEL}
                </Button>
              )}
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
