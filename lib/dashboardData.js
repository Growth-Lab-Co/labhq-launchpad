// Aggregates everything the Miia customer dashboard renders, from real
// stores/APIs only - see the honesty rules in the dashboard commit message.
// Every field here is either real data or explicitly null/omitted; nothing
// in components/dashboard should ever fall back to a placeholder number.

import { listActivity } from "./activity.js";
import { getBotSettings } from "./botSettings.js";
import { ghlCredsFor } from "./tenants.js";
import { resolveLocationDataAuth, listConversations, listCalendarEvents, listMessages } from "./ghl.js";
import { getLeadsieConnection } from "./leadsieConnections.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// Best-effort GHL location auth - every caller below treats a missing token
// as "no live GHL data available" (not an error), so a tenant without
// calendar/conversation access yet just gets honest empty states.
async function resolveAuth(tenant, deployment) {
  if (!deployment?.locationId) return null;
  try {
    const legacyCreds = ghlCredsFor(tenant);
    const auth = await resolveLocationDataAuth({
      tenantSlug: tenant.slug,
      locationId: deployment.locationId,
      legacyCreds,
    });
    return auth.token ? { token: auth.token, locationId: deployment.locationId } : null;
  } catch {
    return null;
  }
}

// Channel "live" status is a proxy, not a GHL-verified signal - the location
// app currently has no scope that reports real webchat/FB/IG/SMS connection
// state (see lib/channelWiring.js's header comment, same limitation). This
// reads the closest honest signal available: the bot is switched on overall
// AND toggled for that specific channel. SMS's real-world "registering"
// window (1-2 day A2P 10DLC clearance) has no live signal either, so it
// collapses to "not started" until it flips true - see the dashboard
// commit's NOTES for what would close this gap (phonenumbers.read /
// chat-widget.readonly / adPublishing.readonly scopes).
function channelStatus(botSettings, key) {
  return botSettings.enabled && botSettings.channels?.[key] ? "live" : "not_started";
}

// Facebook and Instagram share one GHL connection (lib/channelWiring.js's
// own header comment) - shown as a single row, live if either bot-settings
// toggle is on, so the "channels live of N" count on the home page's stat
// card and the Channels card/page all agree on the same total (4, matching
// the approved design's "3 of 4 live").
export async function getChannelsData(tenant, deployment, signup) {
  const botSettings = deployment ? await getBotSettings(tenant.slug, deployment.locationId) : null;
  const hasVoice = signup?.plan === "complete";
  const socialLive = botSettings ? Boolean(botSettings.enabled && (botSettings.channels?.fb || botSettings.channels?.ig)) : false;

  // "connecting" = Leadsie confirmed the client granted Facebook/Instagram
  // access, but that's not the same as GHL's own integration being wired up
  // and the bot switched on for it (see lib/leadsieConnections.js header) -
  // never claim "live" from this signal alone.
  const leadsie = socialLive ? null : await getLeadsieConnection(tenant.slug).catch(() => null);
  const socialConnecting = !socialLive && Boolean(leadsie && (leadsie.status === "received" || leadsie.status === "partial"));

  const channels = [
    { id: "webchat", label: "Website chat", status: botSettings ? channelStatus(botSettings, "webchat") : "not_started" },
    { id: "sms", label: "SMS", status: botSettings ? channelStatus(botSettings, "sms") : "not_started" },
    {
      id: "social",
      label: "Facebook and Instagram",
      status: socialLive ? "live" : socialConnecting ? "connecting" : "not_started",
      hint: socialConnecting ? "Access received - our team is finishing the connection." : undefined,
    },
  ];

  // Phone/voice: rule is "render only when the plan includes voice AND the
  // number is live" - there is currently no live signal for the second half
  // at all (no botSettings channel key for it, no GHL scope), so it can
  // never honestly show "live" yet. Non-voice plans get the quiet upgrade
  // hint instead, per spec.
  const phone = hasVoice
    ? { id: "phone", label: "Phone", status: "not_started" }
    : { id: "phone", label: "Phone", status: "upgrade", hint: "Available on Miia Everything" };

  return { channels: [...channels, phone], locationAuthNeeded: Boolean(deployment?.locationAuthNeeded) };
}

async function fetchRecentConversations(tenant, deployment) {
  const auth = await resolveAuth(tenant, deployment);
  if (!auth) return null; // null = "couldn't check", not "zero"
  try {
    return await listConversations({ token: auth.token, locationId: auth.locationId, limit: 50 });
  } catch {
    return null;
  }
}

async function fetchUpcomingEvents(tenant, deployment, { pastDays = 1, futureDays = 30 } = {}) {
  const auth = await resolveAuth(tenant, deployment);
  if (!auth) return null;
  try {
    const now = Date.now();
    return await listCalendarEvents({
      token: auth.token,
      locationId: auth.locationId,
      startMs: now - pastDays * DAY_MS,
      endMs: now + futureDays * DAY_MS,
    });
  } catch {
    return null;
  }
}

// Reply-time samples: pairs each "Received:" activity entry with the very
// next "Replied:" entry after it (no conversationId is stored on activity
// entries today - see lib/bot.js logActivity calls - so this is a
// chronological-adjacency proxy, accurate for the low concurrent-volume a
// new Miia tenant actually has, not a true per-conversation join).
function replyTimeSamplesForDay(entries, day) {
  const dayEntries = entries
    .filter((e) => e.type === "bot_message" && isSameDay(new Date(e.createdAt), day))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const samples = [];
  let pendingReceivedAt = null;
  for (const e of dayEntries) {
    if (e.text?.startsWith("Received:")) {
      pendingReceivedAt = new Date(e.createdAt).getTime();
    } else if (e.text?.startsWith("Replied:") && pendingReceivedAt) {
      samples.push(new Date(e.createdAt).getTime() - pendingReceivedAt);
      pendingReceivedAt = null;
    }
  }
  return samples;
}

function average(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// Everything the dashboard home page needs, assembled in parallel. Trend
// chips (todayVsYesterday) are only meaningful once both values are real
// numbers - callers must check both are non-null before rendering a chip
// (see components/dashboard/StatGrid.jsx), never inferring a trend from one
// side missing.
export async function getDashboardHomeData(tenant, deployment, signup) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - DAY_MS);

  const [activity, conversations, events, channelsData] = await Promise.all([
    listActivity(tenant.slug).catch(() => []),
    fetchRecentConversations(tenant, deployment),
    fetchUpcomingEvents(tenant, deployment),
    getChannelsData(tenant, deployment, signup),
  ]);

  const conversationsToday = conversations
    ? conversations.filter((c) => c.dateUpdated && isSameDay(new Date(c.dateUpdated), now)).length
    : null;
  const conversationsYesterday = conversations
    ? conversations.filter((c) => c.dateUpdated && isSameDay(new Date(c.dateUpdated), yesterday)).length
    : null;

  const bookingsToday = events
    ? events.filter((e) => e.dateAdded && isSameDay(new Date(e.dateAdded), now)).length
    : null;
  const bookingsYesterday = events
    ? events.filter((e) => e.dateAdded && isSameDay(new Date(e.dateAdded), yesterday)).length
    : null;

  const replySamplesToday = replyTimeSamplesForDay(activity, now);
  const replySamplesYesterday = replyTimeSamplesForDay(activity, yesterday);
  const avgReplyMsToday = average(replySamplesToday);
  const avgReplyMsYesterday = average(replySamplesYesterday);

  // Same channel list the Channels card/page shows, so the two numbers on
  // this page can never disagree.
  const channelsLiveCount = channelsData.channels.filter((c) => c.status === "live").length;
  const channelsCap = channelsData.channels.length;

  const latestConversationMeta = conversations?.length
    ? conversations.slice().sort((a, b) => new Date(b.dateUpdated) - new Date(a.dateUpdated))[0]
    : null;
  let latestConversation = null;
  if (latestConversationMeta) {
    const auth = await resolveAuth(tenant, deployment);
    const messages = auth
      ? await listMessages({ token: auth.token, conversationId: latestConversationMeta.id, limit: 4 }).catch(() => [])
      : [];
    latestConversation = { ...latestConversationMeta, messages }; // messages: newest-first
  }

  const bookingsTodayList = events
    ? events
        .filter((e) => e.startTime && isSameDay(new Date(e.startTime), now))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    : null;

  return {
    stats: {
      conversationsToday,
      conversationsYesterday,
      bookingsToday,
      bookingsYesterday,
      avgReplyMsToday,
      avgReplyMsYesterday,
      channelsLiveCount,
      channelsCap,
    },
    latestConversation,
    activity: activity.slice(0, 8),
    bookingsTodayList,
    bookingsTodayTotal: bookingsTodayList?.length ?? null,
    // Revenue protected needs (a) after-hours bookings this month and (b) an
    // average appointment/job value - (b) is never captured anywhere in the
    // intake today (checked lib/questions.js INTERVIEW_FIELDS - no such
    // field exists). Per the honesty rules this card simply never renders
    // rather than guessing - see the dashboard commit's NOTES list.
    revenueProtected: null,
  };
}

// Billing page's "usage this month" - counts "Replied:" activity entries in
// the current calendar month. No persistent monthly counter exists (the
// bot engine is out of scope to touch - see the dashboard commit message),
// so this is a best-effort read of the (500-entry-capped) activity log
// rather than a durable counter. Accurate for the realistic current volume
// of a new Miia tenant; would undercount a tenant genuinely near/over 500
// total activity entries in a month - flagged in NOTES.
export async function getMonthlyUsage(tenantSlug) {
  const activity = await listActivity(tenantSlug).catch(() => []);
  const now = new Date();
  const count = activity.filter(
    (e) =>
      e.text?.startsWith("Replied:") &&
      new Date(e.createdAt).getMonth() === now.getMonth() &&
      new Date(e.createdAt).getFullYear() === now.getFullYear()
  ).length;
  const cappedByRetention = activity.length >= 500;
  return { count, cappedByRetention };
}
