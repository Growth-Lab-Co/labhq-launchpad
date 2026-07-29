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

// Business-owner-voiced override of the guidance above, for product:"miia"
// tenants specifically - CHANNEL_WIRING's copy is written for an AGENCY
// setting up a client ("the client clicks approve", raw GHL menu paths),
// wrong for Miia's direct-to-business model where the business owner IS the
// one reading it. Used by components/Chat.jsx's post-deploy screen and the
// customer dashboard's Channels page.
export const MIIA_CHANNEL_COPY = {
  webchat: "Copy the snippet below and paste it into your website. Ask whoever manages your site if you're not sure how.",
  fb: "Connect your Facebook and Instagram pages with a couple of clicks from your dashboard.",
  sms: "Your text number needs a quick registration, the same one every business completes. Miia takes over the moment it clears, usually 1 to 2 days.",
};

// The real, documented HighLevel chat-widget embed pattern (Sites -> Chat
// Widgets -> Get Code) - verified against HighLevel's own support docs
// 2026-07-28. Needs only the location's ID, not the chat-widget.readonly
// scope this app doesn't request (see the header comment above) - the
// script tag and <chat-widget> element are location-scoped and load live
// from LeadConnector's CDN, so there's nothing to "fetch" from our side.
export function websiteChatEmbedSnippet({ locationId, accent }) {
  const color = accent || "#7C4DFF";
  return [
    "<chat-widget",
    `  style="--chat-widget-primary-color: ${color}; --chat-widget-active-color: ${color}"`,
    `  location-id="${locationId}">`,
    "</chat-widget>",
    '<script src="https://widgets.leadconnectorhq.com/loader.js"',
    '  data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js">',
    "</script>",
  ].join("\n");
}

// The in-house Miia widget (job 1, 2026-07-29 build) - replaces the GHL
// chat-widget snippet above as what the Channels page hands new Chat
// activations. Existing customers who already pasted the GHL snippet keep
// working untouched (websiteChatEmbedSnippet above is left in place, not
// deleted - still real, still correct for anyone already using it) - this
// is only what the dashboard now offers going forward. One <script> tag,
// no separate element, keyed by the tenant's own public widgetKey
// (lib/widgetKeys.js) rather than a GHL locationId.
export function miiaWidgetEmbedSnippet({ widgetKey }) {
  return `<script src="https://meetmiia.com/widget.js" data-miia-key="${widgetKey}" async></script>`;
}
