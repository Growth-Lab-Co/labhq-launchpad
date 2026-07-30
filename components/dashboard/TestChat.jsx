"use client";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { TwoDots } from "./TwoDots";
import styles from "./TestChat.module.css";

// Never a raw error, never "Couldn't reach Miia" as a scary banner - a
// visitor waited for this, so the least the chat owes them is a calm human
// line, shown as the reply itself. Kept in sync in spirit with
// netlify/functions/widget-reply-background.mjs's own CALM_FAILURE_TEXT
// (that one covers the background function giving up; this one covers the
// poll itself never landing, e.g. a dropped network).
const CALM_FALLBACK_TEXT = "Sorry, that's taking longer than it should. Please try sending that again in a moment.";
const POLL_INTERVAL_MS = 1500;
// ~2 minutes - comfortably above the background function's own worst case
// (3 attempts x a ~30-36s reply + retry delays).
const POLL_MAX_ATTEMPTS = 80;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The dashboard's "try her yourself" chat and the in-house Miia widget
// (public/widget.js) share the exact same submit-then-poll contract against
// /api/widget/message (POST to submit, GET to poll) - a Netlify Background
// Function generates the reply fully decoupled from any live connection
// (see that route's own header comment for why: Claude's response time from
// this environment collided with Netlify's own connection ceiling under the
// previous streaming design). Same-origin (dashboard is on meetmiia.com),
// so none of the CORS handling the embedded widget needs applies here.
export function TestChat({ tenantSlug, widgetKey, triggerClassName, triggerLabel = "Open test chat" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]); // [{ direction: "inbound"|"outbound", body }]
  const conversationIdRef = useRef(null);

  async function pollForReply() {
    const query = `conversationId=${encodeURIComponent(conversationIdRef.current)}&widgetKey=${encodeURIComponent(widgetKey)}`;
    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(`/api/widget/message?${query}`);
        const data = await res.json();
        if (data.status === "complete" || data.status === "failed") {
          return data.reply || CALM_FALLBACK_TEXT;
        }
      } catch {
        // Transient - keep polling until the attempt budget runs out.
      }
      await wait(POLL_INTERVAL_MS);
    }
    return CALM_FALLBACK_TEXT;
  }

  async function send(e) {
    e.preventDefault();
    if (!input.trim() || busy || !widgetKey) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { direction: "inbound", body: text }, { direction: "outbound", body: "" }]);

    const finish = (body) => {
      setMessages((m) => {
        const next = [...m];
        next[next.length - 1] = { direction: "outbound", body };
        return next;
      });
      setBusy(false);
    };

    try {
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ widgetKey, conversationId: conversationIdRef.current, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || CALM_FALLBACK_TEXT);
      if (data.conversationId) conversationIdRef.current = data.conversationId;
      if (data.immediate) {
        finish(data.immediate);
        return;
      }
      const reply = await pollForReply();
      finish(reply);
    } catch {
      finish(CALM_FALLBACK_TEXT);
    }
  }

  if (!open) {
    return (
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        <Send size={16} /> {triggerLabel}
      </button>
    );
  }

  const lastIsEmptyOutbound =
    messages.length > 0 && messages[messages.length - 1].direction === "outbound" && !messages[messages.length - 1].body && busy;

  return (
    <div className={styles.panel}>
      {messages.length > 0 && (
        <div className={styles.thread}>
          {messages.map((m, i) =>
            i === messages.length - 1 && lastIsEmptyOutbound ? (
              <div key={i} className={styles.typing}>
                <TwoDots size="sm" pulse />
              </div>
            ) : (
              <div key={i} className={m.direction === "inbound" ? styles.bubbleIn : styles.bubbleOut}>
                {m.body}
              </div>
            )
          )}
        </div>
      )}
      <form onSubmit={send} className={styles.form}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Try asking Miia something a customer would"
          className={styles.input}
          autoFocus
        />
        <button type="submit" className={styles.sendBtn} disabled={busy || !input.trim()}>
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
