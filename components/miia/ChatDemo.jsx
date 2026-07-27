"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import styles from "./ChatDemo.module.css";

const CUSTOMER = {
  text: "hi, got water coming through the ceiling near a light, can anyone come today? we're in Stafford Heights. how much roughly?",
  time: "2:14 pm",
};
const REPLY = {
  text: "That needs someone today. We can have a plumber out this afternoon, emergency call out is $250 for the first hour and we service Stafford Heights. Want me to lock in a time between 2 and 4pm?",
  time: "2:15 pm",
};

const TYPE_SPEED = 22; // ms per character
const PHASE = {
  TYPING_CUSTOMER: "typing-customer",
  PAUSE: "pause",
  DOTS: "dots",
  REPLY_IN: "reply-in",
  HOLD: "hold",
  RESET: "reset",
};

// The hero's looping proof-of-life: a real enquiry typing itself out, a
// thinking beat, then Miia's reply sliding in. Freezes on the finished
// exchange under prefers-reduced-motion instead of animating forever.
export function ChatDemo() {
  const [phase, setPhase] = useState(PHASE.TYPING_CUSTOMER);
  const [customerChars, setCustomerChars] = useState(0);
  const timerRef = useRef(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion.current) {
      setCustomerChars(CUSTOMER.text.length);
      setPhase(PHASE.HOLD);
      return;
    }

    function schedule() {
      clearTimeout(timerRef.current);
      if (phase === PHASE.TYPING_CUSTOMER) {
        if (customerChars < CUSTOMER.text.length) {
          timerRef.current = setTimeout(() => setCustomerChars((c) => c + 1), TYPE_SPEED);
        } else {
          timerRef.current = setTimeout(() => setPhase(PHASE.PAUSE), 500);
        }
      } else if (phase === PHASE.PAUSE) {
        timerRef.current = setTimeout(() => setPhase(PHASE.DOTS), 600);
      } else if (phase === PHASE.DOTS) {
        timerRef.current = setTimeout(() => setPhase(PHASE.REPLY_IN), 1400);
      } else if (phase === PHASE.REPLY_IN) {
        timerRef.current = setTimeout(() => setPhase(PHASE.HOLD), 500);
      } else if (phase === PHASE.HOLD) {
        timerRef.current = setTimeout(() => setPhase(PHASE.RESET), 3800);
      } else if (phase === PHASE.RESET) {
        setCustomerChars(0);
        timerRef.current = setTimeout(() => setPhase(PHASE.TYPING_CUSTOMER), 700);
      }
    }
    schedule();
    return () => clearTimeout(timerRef.current);
  }, [phase, customerChars]);

  const showDots = phase === PHASE.DOTS;
  const showReply = phase === PHASE.REPLY_IN || phase === PHASE.HOLD;
  const fadingOut = phase === PHASE.RESET;

  return (
    <div className={styles.card}>
      <div className={styles.bar}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.barTitle}>Website chat</span>
      </div>
      <div className={[styles.body, fadingOut ? styles.bodyFading : ""].join(" ")}>
        <div className={styles.group}>
          <div className={styles.bubbleIn}>
            {CUSTOMER.text.slice(0, customerChars)}
            {phase === PHASE.TYPING_CUSTOMER && <span className={styles.caret} />}
          </div>
          {customerChars === CUSTOMER.text.length && <div className={styles.meta}>{CUSTOMER.time}</div>}
        </div>

        {showDots && (
          <div className={[styles.group, styles.groupOut].join(" ")}>
            <div className={styles.dotsBubble}>
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {showReply && (
          <div className={[styles.group, styles.groupOut, styles.replyEnter].join(" ")}>
            <div className={styles.bubbleOut}>{REPLY.text}</div>
            <div className={styles.meta}>
              {REPLY.time} <Check size={12} strokeWidth={2.5} />
              <Image src="/miia-app-icon.png" alt="" width={14} height={14} className={styles.metaIcon} />
              Miia
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
