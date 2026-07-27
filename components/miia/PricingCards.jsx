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

// Defaults to true (founding currently on) so there's no flash of "wrong"
// pricing while the request is in flight - matches the value MIIA_FOUNDING_MODE
// actually has today. Once the real value loads, if it's false the founding
// price/strike-through disappears.
export function useFoundingMode() {
  const [founding, setFounding] = useState(true);
  useEffect(() => {
    fetch("/api/miia/config")
      .then((r) => r.json())
      .then((d) => setFounding(Boolean(d.foundingMode)))
      .catch(() => {});
  }, []);
  return founding;
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

export function PricingToggle({ yearly, onChange, foundingMode }) {
  return (
    <div className={styles.toggleWrap}>
      <div className={styles.toggleRowInner}>
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
      {foundingMode && <p className={styles.toggleNote}>Founding pricing is monthly only. Yearly uses standard pricing.</p>}
    </div>
  );
}

// Yearly is always the standard price (no founding-yearly price exists).
// Monthly shows founding-with-strikethrough only while founding mode is on.
function PriceTag({ plan, yearly, foundingMode }) {
  const showFounding = foundingMode && !yearly;
  const standard = yearly ? yearlyPerMonth(plan.price) : plan.price;
  const founding = yearly ? standard : plan.foundingPrice;
  const standardDisplay = useRollingNumber(standard);
  const foundingDisplay = useRollingNumber(founding);

  if (!showFounding) {
    return (
      <div className={styles.priceRow}>
        <span className={styles.priceFounding}>
          ${standardDisplay}
          <span className={styles.pricePer}>/mo{yearly ? ", billed yearly" : ""}</span>
        </span>
      </div>
    );
  }

  return (
    <div className={styles.priceRow}>
      <span className={styles.priceStandard}>${standardDisplay}</span>
      <span className={styles.priceFounding}>
        ${foundingDisplay}
        <span className={styles.pricePer}>/mo</span>
      </span>
    </div>
  );
}

export function PricingCards({ selectedId, onSelect, showCta = true, yearly: yearlyProp, onYearlyChange }) {
  const [yearlyState, setYearlyState] = useState(false);
  const yearly = yearlyProp !== undefined ? yearlyProp : yearlyState;
  const setYearly = onYearlyChange || setYearlyState;
  const foundingMode = useFoundingMode();

  return (
    <div>
      <div className={styles.toggleRow}>
        <PricingToggle yearly={yearly} onChange={setYearly} foundingMode={foundingMode} />
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

              <PriceTag plan={plan} yearly={yearly} foundingMode={foundingMode} />

              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} strokeWidth={2.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!selectable && showCta && (
                <Button
                  href={`/get-started?plan=${plan.id}${yearly ? "&billing=yearly" : ""}`}
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
