// Rewrites lib/activity.js entries (written in operator language, e.g.
// "AI bot handed off to a human - tagged in GHL...") into customer-facing
// copy for the dashboard's Live activity feed. Never invents a name or
// detail the underlying entry doesn't have - a generic "a customer" stands
// in wherever the source entry has no contact name (activity entries don't
// carry one - see lib/bot.js's logActivity calls).
import { Phone, MessageSquare, Globe, Handshake, Rocket } from "lucide-react";

const PATTERNS = [
  { test: (t) => t.startsWith("Received:"), icon: MessageSquare, text: (t) => `New enquiry: ${t.slice("Received:".length).trim()}` },
  { test: (t) => t.startsWith("Replied:"), icon: MessageSquare, text: (t) => `Miia replied: ${t.slice("Replied:".length).trim()}` },
  { test: (t) => /handed off to a human/i.test(t), icon: Handshake, text: () => "Miia handed a conversation to your team" },
  { test: (t) => /^system deployed$/i.test(t), icon: Rocket, text: () => "Miia went live" },
  { test: (t) => /data sync needs authorisation/i.test(t), icon: Globe, text: () => "One of your channels needs reconnecting" },
];

export function customerActivityEntry(entry) {
  const text = entry.text || "";
  const match = PATTERNS.find((p) => p.test(text));
  return {
    id: entry.id,
    icon: match?.icon || Phone,
    text: match ? match.text(text) : text,
    createdAt: entry.createdAt,
  };
}

export function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}
