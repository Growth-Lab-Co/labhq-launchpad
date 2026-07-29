"use client";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { TwoDots } from "./TwoDots";
import styles from "./TestChat.module.css";

// The dashboard's "try her yourself" chat and the in-house Miia widget
// (public/widget.js) are now the same underlying conversation - this talks
// directly to /api/widget/message with the tenant's own widgetKey, the
// exact same endpoint a customer's embedded widget calls, with real
// multi-turn history (see lib/widgetConversations.js) and streaming
// replies. Same-origin (dashboard is on meetmiia.com), so none of the CORS
// handling the embedded widget needs applies here.
export function TestChat({ tenantSlug, widgetKey, triggerClassName, triggerLabel = "Open test chat" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]); // [{ direction: "inbound"|"outbound", body }]
  const [error, setError] = useState(null);
  const conversationIdRef = useRef(null);

  async function send(e) {
    e.preventDefault();
    if (!input.trim() || busy || !widgetKey) return;
    const text = input.trim();
    setInput("");
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { direction: "inbound", body: text }, { direction: "outbound", body: "" }]);

    try {
      const res = await fetch("/api/widget/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ widgetKey, conversationId: conversationIdRef.current, message: text }),
      });
      const convId = res.headers.get("X-Conversation-Id");
      if (convId) conversationIdRef.current = convId;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Couldn't reach Miia. Try again.");
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { direction: "outbound", body: data.text || "" };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = { direction: "outbound", body: full };
          return next;
        });
      }
    } catch (e) {
      setError(e.message);
      setMessages((m) => m.slice(0, -1)); // drop the empty placeholder reply
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
