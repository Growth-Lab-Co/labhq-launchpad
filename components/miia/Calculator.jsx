"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import styles from "./Calculator.module.css";

const CONVERSION_RATE = 0.3;

function formatCurrency(n) {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString("en-AU");
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

// Animates a number rolling from its previous value to the next whenever
// `value` changes, not just on scroll-into-view (the calculator recomputes
// on every input tweak).
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
    const duration = 500;
    cancelAnimationFrame(rafRef.current);

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
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

  return display;
}

// `missed*` and `value*` props let a page tune the calculator to its own
// cadence and price range (e.g. the allied-health page uses "per week" and a
// $50-$500 appointment value) while sharing the same 30%-recovery math and
// UI. `periodsPerMonth` converts the missed-count cadence to a monthly
// figure - 30 for "per day", ~4.345 (52 weeks / 12 months) for "per week".
export function Calculator({
  missedLabel = "Missed or unanswered enquiries per day",
  missedDefault = 5,
  missedMax = 200,
  periodsPerMonth = 30,
  valueLabel = "Average value of a new customer",
  valueMin = 100,
  valueMax = 20000,
  valueDefault = 2500,
  valueStep = 100,
}) {
  const [missed, setMissed] = useState(missedDefault);
  const [value, setValue] = useState(valueDefault);

  const monthly = Math.round(missed * value * CONVERSION_RATE * periodsPerMonth);
  const yearly = monthly * 12;
  const monthlyDisplay = useRollingNumber(monthly);
  const yearlyDisplay = useRollingNumber(yearly);

  function stepMissed(delta) {
    setMissed((m) => Math.min(missedMax, Math.max(1, m + delta)));
  }

  return (
    <div className={styles.card}>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="miia-calc-missed">
            {missedLabel}
          </label>
          <div className={styles.stepper}>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() => stepMissed(-1)}
              aria-label="Decrease"
            >
              <Minus size={16} strokeWidth={2.5} />
            </button>
            <input
              id="miia-calc-missed"
              className={styles.stepperValue}
              type="number"
              inputMode="numeric"
              min={1}
              max={missedMax}
              value={missed}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setMissed(Number.isFinite(n) ? Math.min(missedMax, Math.max(1, n)) : 1);
              }}
            />
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() => stepMissed(1)}
              aria-label="Increase"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="miia-calc-slider">
              {valueLabel}
            </label>
            <span className={styles.sliderValue}>{formatCurrency(value)}</span>
          </div>
          <input
            id="miia-calc-slider"
            className={styles.slider}
            type="range"
            min={valueMin}
            max={valueMax}
            step={valueStep}
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value, 10))}
            style={{ "--_fill": `${((value - valueMin) / (valueMax - valueMin)) * 100}%` }}
          />
          <div className={styles.sliderScale}>
            <span>{formatCurrency(valueMin)}</span>
            <span>{formatCurrency(valueMax)}+</span>
          </div>
        </div>
      </div>

      <div className={styles.results}>
        <div className={styles.resultBox}>
          <div className={styles.resultPeriod}>Recovered per month</div>
          <div className={styles.resultAmount}>{formatCurrency(monthlyDisplay)}</div>
        </div>
        <div className={styles.resultBox}>
          <div className={styles.resultPeriod}>Recovered per year</div>
          <div className={styles.resultAmount}>{formatCurrency(yearlyDisplay)}</div>
        </div>
      </div>

      <p className={styles.footnote}>
        Based on a 30% conversion rate on recovered enquiries, a conservative industry average. Miia responds in
        under a minute, 24/7.
      </p>

      <Button href="/pricing" className={styles.cta}>
        {PRIMARY_CTA_LABEL}
      </Button>
    </div>
  );
}
