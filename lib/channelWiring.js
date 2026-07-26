// Channel-wiring guidance shared by the deploy success screen
// (components/Chat.jsx), Mission Control's client detail Setup tab, and the
// AI Replies tab's per-channel status line.
//
// None of these three can be live-detected with the location app's CURRENT
// scopes - the GHL endpoints that would tell us are gated behind scopes we
// don't request: chat-widget.readonly (chat widget config),
// adPublishing.readonly (Facebook/Instagram integration status), and
// phonenumbers.read (phone number / A2P bundle status). Every entry below is
// verified current GHL menu-path guidance, not an API-derived status - see
// DEPLOY.md "Channel wiring" for what adding those scopes would unlock.
//
// Client-safe (no @netlify/blobs import) so it can be imported from
// components/Chat.jsx, which renders for anonymous site visitors.

export const CHANNEL_WIRING = [
  {
    id: "webchat",
    label: "Website chat",
    path: "Sites → Chat Widgets → open (or create) the widget → Get Code",
    detail: "Copy the embed snippet from GHL and paste it on the client's site.",
  },
  {
    id: "fb",
    label: "Facebook and Instagram",
    path: "Settings → Integrations → Connect under Facebook and Instagram",
    detail: "The client clicks approve with their page admin login.",
  },
  {
    id: "sms",
    label: "SMS",
    path: "Settings → Phone Numbers → Trust Center",
    detail: "The same A2P 10DLC registration you complete for every GHL client. The AI takes over the moment it clears.",
  },
];

// bot-settings channel ids (lib/botSettings.js: sms/fb/ig/webchat) map to the
// wiring entries above - fb and ig share one GHL connection (GHL's
// "Facebook and Instagram" integration connects both at once).
export function wiringForChannel(channelId) {
  const key = channelId === "ig" ? "fb" : channelId;
  return CHANNEL_WIRING.find((c) => c.id === key) || null;
}
