"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { mcFetch } from "./api";

const MissionControlContext = createContext(null);

function lastSeenKey(slug) {
  return `labhq:mc:${slug}:activitySeenAt`;
}

export function MissionControlProvider({ slug, tenant, mcKey, toast, children }) {
  const [activity, setActivity] = useState(null);
  const [lastSeenAt, setLastSeenAt] = useState(null);

  useEffect(() => {
    setLastSeenAt(window.localStorage.getItem(lastSeenKey(slug)) || null);
  }, [slug]);

  const refetchActivity = useCallback(async () => {
    if (!mcKey) return;
    try {
      const data = await mcFetch(`/api/activity?tenant=${encodeURIComponent(slug)}`, { mcKey });
      setActivity(data.entries || []);
    } catch {
      // Activity is a nicety - a failed fetch just leaves the feed/badge stale.
    }
  }, [slug, mcKey]);

  useEffect(() => {
    if (mcKey) refetchActivity();
  }, [mcKey, refetchActivity]);

  const markActivitySeen = useCallback(() => {
    const now = new Date().toISOString();
    window.localStorage.setItem(lastSeenKey(slug), now);
    setLastSeenAt(now);
  }, [slug]);

  const unreadCount = useMemo(() => {
    if (!activity) return 0;
    if (!lastSeenAt) return activity.length;
    const seen = new Date(lastSeenAt).getTime();
    return activity.filter((e) => new Date(e.createdAt).getTime() > seen).length;
  }, [activity, lastSeenAt]);

  const copyToClipboard = useCallback(async (text) => {
    if (!text) return false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall through to legacy fallback below
      }
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      slug,
      tenant,
      mcKey,
      toast,
      activity,
      refetchActivity,
      unreadCount,
      markActivitySeen,
      copyToClipboard,
    }),
    [slug, tenant, mcKey, toast, activity, refetchActivity, unreadCount, markActivitySeen, copyToClipboard]
  );

  return <MissionControlContext.Provider value={value}>{children}</MissionControlContext.Provider>;
}

export function useMissionControl() {
  const ctx = useContext(MissionControlContext);
  if (!ctx) throw new Error("useMissionControl must be used within MissionControlProvider");
  return ctx;
}
