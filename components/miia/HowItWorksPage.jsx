"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Reveal } from "./Reveal";
import { Button, PRIMARY_CTA_LABEL } from "./Button";
import styles from "./how-it-works.module.css";

const STEPS = [
  {
    heading: "You have a conversation",
    text: "You tell Miia about your business the way you'd brief a new hire. Services, pricing, hours, how you like to sound. Ten minutes, no forms.",
  },
  {
    heading: "She builds her own brain",
    text: "Everything from that conversation becomes her training. No settings screens, no scripts to write. What used to take weeks of setup happens while you get on with your day.",
  },
  {
    heading: "You connect your channels",
    text: "Website chat, Facebook, Instagram, SMS, phone. Each one is a few clicks, and Miia is trained and ready on every channel from the moment you add it.",
  },
  {
    heading: "She goes live and starts working",
    text: "Every enquiry gets a real answer in under a minute, day or night. Bookings land straight in your calendar. She hands over to you the second a customer needs the real thing.",
  },
  {
    heading: "You stay in control",
    text: "Watch her status, read every conversation, send a test message any time. Nothing happens in your business without you being able to see it.",
  },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  return reduced;
}

function Timeline() {
  const nodeRefs = useRef([]);
  const [activeCount, setActiveCount] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setActiveCount(STEPS.length);
      return;
    }
    const seen = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const i = Number(entry.target.dataset.index);
          if (entry.isIntersecting) seen.add(i);
        });
        setActiveCount(seen.size ? Math.max(...seen) + 1 : 0);
      },
      { threshold: 0.5 }
    );
    nodeRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [reduced]);

  const fillPercent = (activeCount / STEPS.length) * 100;

  return (
    <div className={styles.timeline}>
      <div className={styles.line}>
        <div className={styles.lineFill} style={{ height: `${fillPercent}%` }} />
      </div>
      {STEPS.map((step, i) => (
        <div
          key={step.heading}
          className={styles.node}
          data-index={i}
          ref={(el) => (nodeRefs.current[i] = el)}
        >
          <div className={[styles.badge, i < activeCount ? styles.badgeActive : ""].join(" ")}>
            {String(i + 1).padStart(2, "0")}
          </div>
          <div className={styles.body}>
            <h2 className={styles.heading}>{step.heading}</h2>
            <p className={styles.text}>{step.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HowItWorksPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Reveal className={styles.intro}>
          <Image
            src="/miia-app-icon.png"
            alt=""
            width={56}
            height={56}
            className={styles.introMark}
            style={{ borderRadius: 16 }}
          />
          <h1 className={styles.h1}>How Miia works</h1>
          <p>
            No dev team, no six week build, no bot to script. Just a conversation, and a system that sets itself
            up from it.
          </p>
        </Reveal>

        <Timeline />

        <Reveal className={styles.finalCta}>
          <h2 className={styles.finalCtaHeading}>See it happen with your own business.</h2>
          <Button href="/get-started" variant="onDark">
            {PRIMARY_CTA_LABEL}
          </Button>
        </Reveal>
      </div>
    </div>
  );
}
