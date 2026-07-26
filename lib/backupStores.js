// Registry of every Netlify Blobs store in the app, enumerated by hand from
// each lib/*.js file's STORE_NAME constant (grep for `blobStore({ name:` to
// re-verify this list any time a store is added or renamed). This is the
// single source of truth for lib/backup.js, the scheduled backup function,
// the admin Backups page, and scripts/restore-backup.mjs - all four read
// from here so nothing can drift out of sync.
//
// Four stores are deliberately EXCLUDED from backup: they hold short-lived,
// self-regenerating data (login sessions, one-time reset tokens, rolling
// rate-limit counters). Restoring a day-old session or reset token is
// meaningless at best and a stale-credential risk at worst, and rate-limit
// counters have zero business value a day later. Losing them in a disaster
// just means people log in again - nothing else re-derives from them.

export const BACKUP_STORES = [
  { name: "tenants", label: "Tenants", description: "Dynamic tenant registry (seed tenants growthlab/obm/demo are code-only, not stored)" },
  { name: "accounts", label: "Accounts", description: "Portal account records, encrypted at rest" },
  { name: "account-email-index", label: "Account email index", description: "Email -> account ID lookup for login" },
  { name: "deployments", label: "Deployments", description: "Mission Control deployment log" },
  { name: "ghl-connections", label: "GHL connections", description: "GHL OAuth tokens, encrypted at rest" },
  { name: "checklists", label: "Checklists", description: "Per-tenant go-live checklist state" },
  { name: "checklist-templates", label: "Checklist templates", description: "Per-tenant custom checklist templates" },
  { name: "branding", label: "Branding", description: "Per-tenant branding config (accent, welcome message, asset URLs)" },
  { name: "branding-assets", label: "Branding assets", description: "Uploaded logo/favicon bytes" },
  { name: "activity", label: "Activity", description: "Per-tenant Mission Control activity log" },
  { name: "admin-activity", label: "Admin activity", description: "Operator audit log (/admin/activity)" },
  { name: "mc-auth", label: "Mission Control passwords", description: "Per-tenant Mission Control password hashes" },
  { name: "team-members", label: "Team", description: "Mission Control team members per tenant" },
  { name: "notification-settings", label: "Notifications", description: "Per-tenant notification preferences" },
  { name: "claim-links", label: "Claim links", description: "Claim link tokens" },
  { name: "claim-links-by-tenant", label: "Claim links (by tenant)", description: "Claim link tenant index" },
  { name: "invite-codes", label: "Invite codes", description: "Portal invite codes" },
  { name: "snapshot-templates", label: "Snapshot templates", description: "Per-tenant GHL snapshot template registry" },
  { name: "bot-settings", label: "AI Replies settings", description: "Per-location conversation bot configuration (on/off, channels, quiet hours)" },
  { name: "location-tenant-index", label: "Location -> tenant index", description: "Cache mapping a GHL locationId to the tenant that owns it, for webhook routing" },
];

export const EXCLUDED_STORES = [
  { name: "portal-sessions", reason: "Ephemeral login sessions - safe to lose, users just log back in" },
  { name: "account-sessions", reason: "Ephemeral login sessions - safe to lose, users just log back in" },
  { name: "password-resets", reason: "One-time tokens, short TTL - stale by the time any restore would run" },
  { name: "rate-limits", reason: "Rolling per-IP counters - no business value, would be stale immediately" },
  { name: "bot-counters", reason: "Rolling per-conversation reply counters and handoff flags - self-regenerating, no business value a day later" },
];

export const BACKUP_STORE_NAMES = BACKUP_STORES.map((s) => s.name);
