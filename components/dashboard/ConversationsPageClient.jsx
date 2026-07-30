"use client";
import { useState } from "react";
import { Search, MessageSquare, ArrowLeft } from "lucide-react";
import { Card, CardEmpty, CardLoading } from "./Card";
import { TestChat } from "./TestChat";
import styles from "./ConversationsPageClient.module.css";

function timeOf(iso) {
  return iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
}

export function ConversationsPageClient({ tenantSlug, widgetKey, conversations }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const filtered = (conversations || []).filter((c) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (c.contactName || "").toLowerCase().includes(q) || (c.lastMessageBody || "").toLowerCase().includes(q);
  });

  async function selectConversation(id) {
    setSelectedId(id);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/miia/dashboard/conversations/${id}?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load this conversation.");
      setMessages(data.messages || []);
    } catch (e) {
      setError(e.message);
      setMessages(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className={styles.heading}>Conversations</h1>
      {conversations !== null && (
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search conversations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {conversations === null ? (
        <Card style={{ marginTop: 20, textAlign: "center" }}>
          <CardEmpty
            icon={MessageSquare}
            title="No conversations yet"
            body="Once a channel's connected, every conversation Miia has will show up here."
            action={<TestChat tenantSlug={tenantSlug} widgetKey={widgetKey} triggerClassName={styles.primaryBtn} />}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={{ marginTop: 20 }}>
          <CardEmpty icon={MessageSquare} title="No matches" body="Try a different search." />
        </Card>
      ) : (
        <div className={[styles.layout, selectedId ? styles.hasSelection : ""].filter(Boolean).join(" ")}>
          <div className={styles.list}>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectConversation(c.id)}
                className={[styles.row, selectedId === c.id ? styles.rowActive : ""].filter(Boolean).join(" ")}
              >
                <p className={styles.rowName}>
                  {c.contactName || "Unknown contact"}
                  {c.source === "widget" && <span className={styles.sourceBadge}>Website</span>}
                </p>
                <p className={styles.rowSnippet}>{c.lastMessageBody || " "}</p>
                <p className={styles.rowTime}>{timeOf(c.dateUpdated)}</p>
              </button>
            ))}
          </div>
          <div className={styles.transcript}>
            {selectedId && (
              <button type="button" className={styles.backBtn} onClick={() => setSelectedId(null)}>
                <ArrowLeft size={16} /> Back to conversations
              </button>
            )}
            {!selectedId ? (
              <CardEmpty icon={MessageSquare} title="Pick a conversation" body="Select one from the list to read the full transcript." />
            ) : loading ? (
              <CardLoading label="Loading transcript" />
            ) : error ? (
              <CardEmpty icon={MessageSquare} title="Couldn't load this" body={error} />
            ) : (
              (messages || [])
                .slice()
                .reverse()
                .map((m, i) => (
                  <div key={i} className={m.direction === "outbound" ? styles.bubbleOut : styles.bubbleIn}>
                    {m.body}
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
