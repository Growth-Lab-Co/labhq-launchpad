// Shared status/date logic for the Clients table and Client detail page.
// The 5-step pipeline (deployed -> ... -> live) is the real operator-driven
// status stored on the deployment record; STATUS_LABEL collapses it down to
// the 4-state display status the reference design uses (Live/QA/Setting
// up/Attention).

export const STATUS_STEPS = [
  { key: "deployed", label: "Deployed" },
  { key: "calendar_connected", label: "Calendar connected" },
  { key: "phone_live", label: "Phone live" },
  { key: "qa_passed", label: "QA passed" },
  { key: "live", label: "Live" },
];

// True when a deployment needs an operator to authorise or retry its GHL
// data sync - either the location app was never authorised, or it was but
// some custom values still failed to push. `syncFailures` only exists on
// records written after this tracking was added, so older already-synced
// deployments (undefined syncFailures) don't get retroactively flagged.
export function needsDataSync(deployment) {
  return Boolean(deployment.locationAuthNeeded) || Boolean(deployment.syncFailures?.length);
}

export function displayStatus(deployment) {
  if (needsDataSync(deployment)) return "Attention";
  if (deployment.status === "live") return "Live";
  if (deployment.status === "qa_passed") return "QA";
  return "Setting up";
}

const BADGE_CONFIG = {
  Live: { dot: "#22C55E", text: "#16A34A", bg: "#F0FDF4" },
  QA: { dot: "#F59E0B", text: "#B45309", bg: "#FFFBEB" },
  "Setting up": { dot: "#9CA3AF", text: "#6B7280", bg: "#F9FAFB" },
  Attention: { dot: "#EF4444", text: "#DC2626", bg: "#FEF2F2" },
};

export function statusBadgeConfig(status) {
  return BADGE_CONFIG[status] || BADGE_CONFIG["Setting up"];
}

export function progressColor(status) {
  if (status === "Live") return "#22C55E";
  if (status === "Attention") return "#EF4444";
  return "#F59E0B";
}

export function initialsFor(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

export function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function relativeTime(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) {
    const m = Math.round(diffMs / minute);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffMs < day) {
    const h = Math.round(diffMs / hour);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  if (diffMs < week) {
    const d = Math.round(diffMs / day);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }
  if (diffMs < month) {
    const w = Math.round(diffMs / week);
    return `${w} week${w === 1 ? "" : "s"} ago`;
  }
  const mo = Math.round(diffMs / month);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

// Standard GHL sub-account deep link - opens the location's dashboard directly.
export function ghlLocationUrl(locationId) {
  return `https://app.gohighlevel.com/v2/location/${locationId}/dashboard`;
}
