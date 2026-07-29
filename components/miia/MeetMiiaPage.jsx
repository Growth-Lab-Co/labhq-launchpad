"use client";
import { useState } from "react";
import styles from "./MeetMiiaPage.module.css";

// The same in-house widget (public/widget.js) that powers a customer's
// embedded chat also powers this preview - job 1's "the same widget powers
// 'Meet Miia' on the marketing site". Ephemeral: the scraped business
// context and conversation live only in lib/previewSessions.js, never a
// real tenant, never GHL, never the signups queue.
export function MeetMiiaPage() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // idle | starting | started | error
  const [error, setError] = useState(null);
  const [businessName, setBusinessName] = useState(null);

  async function start(e) {
    e.preventDefault();
    if (!url.trim() || status === "starting") return;
    setStatus("starting");
    setError(null);
    try {
      const res = await fetch("/api/preview/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't preview that site - try another URL.");

      setBusinessName(data.businessName);
      setStatus("started");

      const script = document.createElement("script");
      script.src = "/widget.js";
      script.setAttribute("data-miia-preview", data.previewId);
      script.async = true;
      script.onload = function () {
        setTimeout(function () {
          var launcher = document.querySelector(".miia-widget-launcher");
          if (launcher) launcher.click();
        }, 150);
      };
      document.body.appendChild(script);
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.eyebrow}>This is a preview of your Miia</span>
      <h1 className={styles.title}>Paste your website. Meet your Miia.</h1>
      <p className={styles.sub}>
        We&apos;ll take a quick look at your site and spin up a live preview of Miia trained on what we find - ask her
        anything a customer would.
      </p>

      <form className={styles.form} onSubmit={start}>
        <input
          type="text"
          className={styles.input}
          placeholder="yourbusiness.com.au"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status === "starting" || status === "started"}
        />
        <button type="submit" className={styles.submit} disabled={status === "starting" || status === "started" || !url.trim()}>
          {status === "starting" ? "Reading your site…" : "Meet Miia"}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.hint}>10 free messages, no signup needed to start.</p>

      {status === "started" && (
        <div className={styles.started}>
          <p className={styles.startedTitle}>Miia&apos;s ready for {businessName}</p>
          <p className={styles.startedBody}>
            Look for the chat bubble in the bottom-right corner - that&apos;s your live preview.
          </p>
        </div>
      )}
    </div>
  );
}
