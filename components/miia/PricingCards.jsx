"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import { PLANS, VOICE_PLAN } from "./plans";
import { BOOKING_URL } from "./site";
import { trackInitiateCheckout } from "@/lib/metaPixel";
import { readUtm } from "@/lib/utm";
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

// No yearly toggle (removed 2026-07-31 - see git history): the offer
// changed since it was built and only Miia Everywhere ever had a real
// annual price, Chat never did and Voice is demo-only, so a single
// monthly/yearly switch across all cards was never going to be correct for
// all of them. Founding pricing is monthly-only anyway, so every visitor
// during founding is on this path regardless. Always shows founding (with
// strikethrough) while founding mode is on, plain price once it's off.
function PriceTag({ plan, foundingMode }) {
  const standardDisplay = useRollingNumber(plan.price);
  const foundingDisplay = useRollingNumber(plan.foundingPrice);

  if (!foundingMode) {
    return (
      <div className={styles.priceRow}>
        <span className={styles.priceFounding}>
          ${standardDisplay}
          <span className={styles.pricePer}>/mo</span>
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

export function PricingCards({ selectedId, onSelect, showCta = true, vertical, highlightId }) {
  const foundingMode = useFoundingMode();

  // Direct-checkout mode (showCta, not selectable - i.e. /pricing itself):
  // clicking a plan's CTA highlights that card immediately (purple border,
  // same treatment as the selectable/get-started mode below) and goes
  // straight to Stripe. `highlightId` (from a preselected ?plan= in the URL)
  // pre-highlights a card the same way before any click.
  const [checkoutPlanId, setCheckoutPlanId] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);

  async function startCheckout(plan) {
    if (checkoutPlanId) return;
    setCheckoutPlanId(plan.id);
    setCheckoutError(null);
    try {
      const monthlyPrice = foundingMode ? plan.foundingPrice : plan.price;
      trackInitiateCheckout({ value: monthlyPrice, currency: "AUD", content_name: plan.id });
      const utm = readUtm() || {};
      const res = await fetch("/api/miia/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan: plan.id,
          billingPeriod: "monthly",
          vertical: vertical || "",
          utmSource: utm.utmSource || "",
          utmMedium: utm.utmMedium || "",
          utmCampaign: utm.utmCampaign || "",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (e) {
      setCheckoutError({ planId: plan.id, message: e.message });
      setCheckoutPlanId(null);
    }
  }

  return (
    <div>
      <div className={styles.grid}>
        {PLANS.map((plan) => {
          const selectable = typeof onSelect === "function";
          const isSelected = selectable ? selectedId === plan.id : checkoutPlanId === plan.id || highlightId === plan.id;
          const Wrapper = selectable ? "button" : "div";
          const planError = checkoutError?.planId === plan.id ? checkoutError.message : null;
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

              <PriceTag plan={plan} foundingMode={foundingMode} />

              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={16} strokeWidth={2.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!selectable && showCta && (
                <>
                  <Button
                    onClick={() => startCheckout(plan)}
                    disabled={Boolean(checkoutPlanId)}
                    variant={plan.popular ? "primary" : "outline"}
                    className={styles.cta}
                  >
                    {checkoutPlanId === plan.id ? "Taking you to checkout…" : PRIMARY_CTA_LABEL}
                  </Button>
                  {planError && <p className={styles.ctaError}>{planError}</p>}
                </>
              )}
            </Wrapper>
          );
        })}

        {/* Not self-serve (job 3) - sold by demo, not checkout, so its own
            "Book a 15 minute demo" link always shows regardless of showCta -
            it's never a purchase action to gate the same way. */}
        <div className={[styles.card, styles.cardVoice].join(" ")}>
          <h3 className={styles.name}>{VOICE_PLAN.name}</h3>
          <p className={styles.tagline}>{VOICE_PLAN.tagline}</p>
          <div className={styles.priceRow}>
            <span className={styles.priceFounding}>{VOICE_PLAN.priceLabel}</span>
          </div>
          <ul className={styles.features}>
            {["Miia answers your phone", "Everything in Miia Everywhere", "Set up with you on a call"].map((f) => (
              <li key={f}>
                <Check size={16} strokeWidth={2.5} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button href={BOOKING_URL} variant="outline" className={styles.cta}>
            {VOICE_PLAN.ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
