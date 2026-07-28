"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { TwoDots } from "./TwoDots";
import styles from "./TestChat.module.css";

// Inline "try her yourself" widget - expands in place rather than
// navigating anywhere, since there's no separate test-chat page.
export function TestChat({ tenantSlug, triggerClassName, triggerLabel = "Open test chat" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [exchange, setExchange] = useState(null);
  const [error, setError] = useState(null);

  async function send(e) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const text = input.trim();
    setBusy(true);
    setError(null);
    setExchange({ question: text, reply: null });
    try {
      const res = await fetch("/api/miia/dashboard/test-message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, inboundText: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't reach Miia. Try again.");
      setExchange({ question: text, reply: data.reply });
      setInput("");
    } catch (e) {
      setError(e.message);
      setExchange(null);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        <Send size={16} /> {triggerLabel}
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      {exchange && (
        <div className={styles.exchange}>
          <div className={styles.bubbleIn}>{exchange.question}</div>
          {exchange.reply ? (
            <div className={styles.bubbleOut}>{exchange.reply}</div>
          ) : (
            <div className={styles.typing}>
              <TwoDots size="sm" pulse />
            </div>
          )}
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
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
