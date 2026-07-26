# Launchpad — Deploy & Launch Guide (Bec's copy)

The plan: get this live on Vercel today, run it in demo mode immediately,
wire real GHL credentials as they arrive, deploy OBM's first client Sunday.

---

## 0. What's in the box

- **Chat intake** — Mia interviews the business owner, one question at a time (Claude-powered).
- **Config generator** — turns the interview into 14 custom values (the review screen).
- **Deploy engine** — creates a GHL sub-account from your Lab HQ snapshot and pushes the custom values.
- **Multi-tenant branding** — `obm.labhq.co` shows OBM's brand, `demo.labhq.co` is your sales demo, `growthlab.labhq.co` is for your direct SMB clients.
- **Demo mode** — any tenant without GHL credentials simulates a deploy. You can demo this to OBM *before* their credentials arrive.

## 1. Run it locally (10 min)

```bash
npm install
cp .env.example .env.local        # then fill in ANTHROPIC_API_KEY at minimum
npm run dev
```

Open http://localhost:3000/demo — full flow works in demo mode with just the Anthropic key.

## 2. Deploy to Vercel (15 min)

1. Push this folder to a GitHub repo (Claude Code: "create a private repo labhq-launchpad and push").
2. vercel.com → Add New Project → import the repo → deploy (defaults are fine).
3. Project → Settings → Environment Variables → add everything from `.env.local`.
4. Redeploy.

## 3. Domain: labhq.co with wildcard subdomains (10 min + DNS wait)

Wildcard subdomains require Vercel nameservers:

1. Vercel → Project → Settings → Domains → add `labhq.co` AND `*.labhq.co`.
2. Vercel will show two nameservers (e.g. `ns1.vercel-dns.com`, `ns2.vercel-dns.com`).
3. GoDaddy → labhq.co → Manage DNS → Nameservers → Change → enter Vercel's pair.
4. Wait for propagation (minutes to a few hours). Do this FIRST thing in the morning.

Test: `demo.labhq.co` should load the demo intake. `labhq.co` redirects to your marketing page.

> **Update 2026-07-10 — the project actually runs on Netlify now, not Vercel** (the
> Vercel steps above are historical). DNS for `labhq.co` is Netlify DNS, and a
> `*.labhq.co` DNS record + wildcard SSL cert are both in place. **But Netlify's
> site-routing layer doesn't accept a wildcard in `domain_aliases`** ("has invalid
> characters") — every tenant subdomain still needs an individual domain alias
> registered on the site before it resolves, DNS/SSL notwithstanding. Two
> consequences:
> - This is now automatic: `lib/accounts.js:registerTenantDomain` calls the
>   Netlify API to register `{slug}.labhq.co` the moment a tenant's onboarding
>   completes (needs `NETLIFY_API_TOKEN` set — see `.env.example`). If it fails,
>   the tenant still works at `labhq.co/{slug}` immediately, and the failure
>   shows up in `/admin` with a one-click retry.
> - **The site is capped at 100 domain aliases** on the current plan
>   (`nf_team_pro`) — this approach doesn't scale past that. The real fix is
>   asking Netlify support to enable true wildcard domain routing for site
>   `bdca9a4d-161c-4aac-b823-a0539c4be6a6` (`labhq.co`) — per Netlify's own
>   support forums this requires a support ticket even on Pro, it's not
>   self-serve via the API or dashboard. Worth filing once tenant count starts
>   approaching the cap.

## 4. Snapshot prep in GHL (your biggest job — 1–2 hrs)

Launchpad personalises clients by writing **custom values**; the snapshot must *read* them.

1. In your master Lab HQ sub-account, create these custom values (Settings → Custom Values), exact names:

```
business_name, services_summary, service_area, opening_hours,
qualification_questions, booking_rules, faq_block, tone_style,
greeting_line, escalation_name, escalation_contact, website_url,
mia_guardrails, nurture_hook
```

2. Edit Mia's Voice AI prompt to reference them, e.g.:

> You are Mia, receptionist for {{ custom_values.business_name }}.
> Open every call with: "{{ custom_values.greeting_line }}"
> About the business: {{ custom_values.services_summary }} Serving {{ custom_values.service_area }}. Hours: {{ custom_values.opening_hours }}.
> Qualify callers by asking: {{ custom_values.qualification_questions }}
> Booking rules: {{ custom_values.booking_rules }}
> FAQs you can answer: {{ custom_values.faq_block }}
> Tone: {{ custom_values.tone_style }}
> Never: {{ custom_values.mia_guardrails }}
> If a human is needed, hand off to {{ custom_values.escalation_name }} ({{ custom_values.escalation_contact }}).

3. Do the same in workflow SMS/email templates (use `{{ custom_values.nurture_hook }}` in follow-ups).
4. Delete/blank anything client-specific left over from previous builds.
5. Create the snapshot (Agency view → Snapshots → Create), note its ID.

## 5. Credentials

**Yours (direct SMB deployments):**
- `ANTHROPIC_API_KEY` — console.anthropic.com
- `GHL_AGENCY_TOKEN` — Agency view → Settings → Private Integrations → create token with locations + custom values write scopes
- `GHL_COMPANY_ID` — Agency Settings → Company
- `GHL_SNAPSHOT_ID` — from step 4

**OBM's (tenant `obm`):** same three, from *their* account, into `OBM_GHL_TOKEN`, `OBM_GHL_COMPANY_ID`, `OBM_GHL_SNAPSHOT_ID`. They import your snapshot via share link first (Snapshots → share → send them the link), then create their own snapshot ID from it. Until these are set, obm.labhq.co runs in demo mode — which is fine for Saturday's walkthrough.

## 6. Before the OBM demo — smoke test

```bash
npm run test:ghl
```

Creates "Launchpad Test - DELETE ME" from your snapshot + pushes one custom value.
Open GHL, verify, delete it.

## 7. If GHL says no (most likely Sunday problem)

The GHL API v2 payload occasionally differs by account age/plan. If `test:ghl` fails on create:
- Confirm the token is **agency-level**, not sub-account level.
- Try the alternate snapshot field in `lib/ghl.js`: replace `snapshotId` with `snapshot: { id: snapshotId, type: "own" }`.
- Check the error body it prints — GHL's messages name the offending field.
- Worst case for Sunday: deploy the sub-account manually from the snapshot in GHL (2 min), then paste the custom values from Launchpad's review screen. The client experience is unchanged; you're the API for one deploy. Fix Monday.

## 8. Adding the next agency (2 min, forever)

1. `lib/tenants.js` → copy the obm block, change slug/name/branding.
2. Add `{PREFIX}_GHL_*` env vars in Vercel.
3. Their subdomain gets auto-registered as a Netlify domain alias on
   onboarding completion (see the update note in step 3 above) — usually live
   within seconds, `labhq.co/{slug}` works immediately either way.

## OAuth apps

Two private GHL Marketplace apps, shared across every tenant (they're not
per-agency like the legacy Private Integration tokens):

- **Agency app "Launchpad Agency"** — agency/company-level. Scopes:
  locations read/write, snapshots readonly, companies readonly. Used to
  **create sub-accounts**.
- **Location app "Launchpad Sync"** — sub-account-level. Scopes: customValues
  read/write, customFields read/write, contacts read/write, forms readonly.
  Used for **all location-data writes** (custom values, contacts, forms).

Route names deliberately avoid the string "ghl" — GHL's Marketplace review
rejects listing/redirect URLs containing their own name.

### Env vars

```
GHL_AGENCY_APP_CLIENT_ID
GHL_AGENCY_APP_CLIENT_SECRET
GHL_AGENCY_APP_INSTALL_URL       # the "Install" link from the app's Marketplace listing
GHL_LOCATION_APP_CLIENT_ID
GHL_LOCATION_APP_CLIENT_SECRET
GHL_LOCATION_APP_INSTALL_URL
LAUNCHPAD_MASTER_KEY             # 32+ chars, e.g. `openssl rand -base64 32`
```

Set all six via `netlify env:set NAME "value"` (and mirror into `.env.local`
for local dev) — never commit real values; `.env.example` only has blank
placeholders.

### Connect flow

1. Send whoever needs to authorize a connection to
   `/api/oauth/start?app=agency&tenant=<slug>` (or `app=location`). It
   redirects to that app's GHL authorize URL (the install link's own
   `chooselocation`/consent flow), with a signed `state` param carrying
   which app + tenant this is for.
2. GHL redirects back to `/api/oauth/callback` with a `code`. The route
   verifies `state`, exchanges the code for access + refresh tokens, and
   stores the connection in Netlify Blobs (store `ghl-connections`),
   AES-256-GCM encrypted with `LAUNCHPAD_MASTER_KEY`. Keys:
   `<tenant>:agency`, `<tenant>:location:company` (location app authorized
   at agency/company level), or `<tenant>:location:<locationId>` (location
   app authorized directly against one sub-account).
3. You land on a plain `/api/oauth/connected` confirmation page.

`lib/ghlOAuth.js` handles refresh-on-read automatically (`getValidToken`).

### Two-key auth in `lib/ghl.js`

- **Sub-account creation** (`resolveSubAccountAuth`): uses the tenant's
  agency-app OAuth connection if one exists; otherwise falls back to the
  legacy `GHL_AGENCY_TOKEN`/`{PREFIX}_GHL_TOKEN` Private Integration path
  unchanged.
- **Location data** (`resolveLocationDataAuth`): tries a location-app token
  for that specific location first (minting one from a company-level
  location-app connection via the documented `/oauth/locationToken`
  exchange, if that's how it was authorized), then falls back to the legacy
  token.

### Manual-authorise fallback

If a newly created sub-account has no way to get a location-app token yet
(no company-level location-app connection, and nobody's authorized the
location app directly against it), the deploy **does not fail**:

- `[LOCATION-AUTH-NEEDED]` is logged server-side with the `locationId`.
- The deploy response includes `locationAuthNeeded: true`, and the client
  gets a warning instead of a silent gap.
- The deployment record in Mission Control shows a **"Retry data sync"**
  button. Once someone authorizes the location app for that sub-account
  (`/api/oauth/start?app=location&tenant=<slug>`, then complete GHL's
  consent for that specific location), clicking it re-runs the custom
  value push + contact creation via `/api/deploy/retry-sync`.

## Mission Control

A password-gated deployment log and status dashboard, so anyone on the ops
team can see what's been deployed and where each client is in go-live
without digging through GHL.

- **What it is** — every deploy (real or demo) writes a record to Netlify
  Blobs (store `deployments`) via `lib/deployments.js`: business name,
  contact, location ID, demo flag, and a status. The dashboard reads/writes
  those records through `app/api/deployments/route.js`.
- **URL pattern** — `https://{tenant}.labhq.co/missioncontrol`, e.g.
  `obm.labhq.co/missioncontrol`. On a root host it's
  `labhq.co/{tenant}/missioncontrol`.
- **Password** — self-service, per tenant. The first person to open a
  tenant's dashboard (e.g. `obm.labhq.co/missioncontrol`) is prompted to
  create a password for it (min. 8 characters), hashed and stored in
  Netlify Blobs (store `mc-auth`, via `lib/mcAuth.js`). After that, it's a
  normal login prompt for anyone else opening that tenant's dashboard.
  Nothing to configure before launch.
- **Master override** — the optional `MC_PASSWORD` env var, if set,
  authenticates against *any* tenant's dashboard. Use it to get in (or
  rotate a tenant's password via the API) if a tenant forgets theirs:
  ```bash
  curl -X POST https://labhq.co/api/mc-auth \
    -H "content-type: application/json" -H "x-mc-key: $MC_PASSWORD" \
    -d '{"tenant":"obm","password":"<new password>"}'
  ```
- **Getting there from the app** — on the deploy success screen, add
  `?operator=1` to the URL to reveal a "Mission Control →" link. Clients
  never see this; it's for whoever drove the deploy.
- **Status meanings** (click any step on a row to set it):
  1. `deployed` — sub-account created, custom values pushed. Set automatically.
  2. `calendar_connected` — client's Google/Outlook calendar is connected.
  3. `phone_live` — their phone number is attached/forwarded.
  4. `qa_passed` — the go-live checklist (visible per-row on the dashboard)
     has been run and passed.
  5. `live` — client is fully live and taking real calls/bookings.
- **Branding** — the "Branding" panel on the dashboard lets a tenant upload
  a custom favicon and logo directly (PNG/JPEG/SVG/WebP/GIF, max 2MB) - no
  need to have the image hosted anywhere else. Uploaded files are stored as
  raw bytes in Netlify Blobs (store `branding-assets`) and served back
  through `app/api/branding/asset/route.js`. Live immediately across the
  tenant's intake page and dashboard - no redeploy needed. Each tenant's
  brand accent colour (`lib/tenants.js` → `accent`/`accentSoft`) is applied
  the same way, via CSS custom properties in `app/[tenant]/layout.jsx`.
- **Client onboarding link** — the dashboard shows `{tenant}.labhq.co` with
  a one-click copy button, so an operator can grab the exact link to hand
  to a client.
- **Starting a new client** — the "+ New client" button in the dashboard
  header opens the tenant's normal intake chat (`/{tenant}`) in a new tab -
  the same flow a client would use themselves, for when an operator wants
  to drive it directly.

## Channel wiring

Every channel the AI conversation bot can answer on (website chat, Facebook
and Instagram, SMS) still needs its normal GHL connection made first -
Launchpad doesn't wire any of them for you. The "Connect the channels"
guidance shown on the deploy success screen, the client detail Setup tab,
and the AI Replies tab's channel status all come from one shared list,
`lib/channelWiring.js`.

- **What's detected vs. instructional** - none of the three are live-detected
  right now. The GHL endpoints that would tell us are all gated behind
  scopes the location app doesn't request: `chat-widget.readonly` (chat
  widget config), `adPublishing.readonly` (Facebook/Instagram integration
  status), and `phonenumbers.read` (phone number / A2P bundle status). Every
  entry in `lib/channelWiring.js` is verified current GHL menu-path
  guidance, not an API call - the AI Replies tab is honest about this
  ("Check in GHL") rather than guessing or faking a connected state.
- **Website chat** - `Sites -> Chat Widgets -> open (or create) the widget ->
  Get Code`. This is a real, working GHL endpoint (`GET /chat-widget/list`,
  `GET /chat-widget/data/{locationId}/{id}`) - a future pass could fetch the
  actual embed snippet by adding `chat-widget.readonly` to
  `lib/ghlOAuth.js` `APPS.location.scopes` (same re-authorise-existing-
  clients caveat as the conversations scopes below applies).
  Until then, the deploy success screen and Setup tab both show the menu
  path with a copy button (whatever we can provide without the snippet
  itself).
- **Facebook and Instagram** - `Settings -> Integrations -> Connect under
  Facebook and Instagram`. The client clicks approve with their page admin
  login. No stable deep-link URL into a specific sub-account's integrations
  page was confirmed, so this stays a click path rather than a link -
  `adPublishing.readonly` would unlock `GET /ad-publishing/facebook/
  integration` for a real status.
- **SMS** - `Settings -> Phone Numbers -> Trust Center`, the same A2P 10DLC
  registration every GHL client needs. `phonenumbers.read` would unlock
  `GET /phone-system/numbers/location/{locationId}` for a real status (not
  A2P/bundle status specifically - that lives under GHL's Trust Center API,
  not surfaced in the current scope research).
- **Where it shows up** - the deploy success screen (`components/Chat.jsx`,
  right after the website form embed box), the client detail Setup tab
  (`app/[tenant]/missioncontrol/clients/[id]/page.jsx`, `SetupTab`), and a
  compact per-channel status line under the AI Replies tab's channel toggles
  (links back to the Setup tab's full block).
- **Go-live checklist** - `lib/checklistTemplate.js`'s
  `DEFAULT_CHECKLIST_TEMPLATE` has a new "AI replies" group (chat widget
  embedded, Facebook/Instagram connected, test chat passed, AI replies
  enabled, quiet hours set) - only affects tenants who haven't customised
  their checklist template yet, same as any other template edit (see
  `lib/checklist.js`: a client's checklist materialises from the template
  once, on first read, then never re-syncs against template changes).

## Conversation bot

An AI reply bot that answers inbound SMS/Facebook/Instagram/web chat
messages in a client's voice, using the same business context (custom
values + interview answers) their deployment record already holds. Off by
default for every client - an operator turns it on per client in Mission
Control.

- **Scopes** - the Location app "Launchpad Sync" needs four additional
  scopes added in the GHL Marketplace dev console:
  `conversations.readonly`, `conversations.write`,
  `conversations/message.readonly`, `conversations/message.write`.
  `lib/ghlOAuth.js` already requests them, but **clients authorised before
  this change need to re-authorise** ("Authorise data sync" on their client
  detail page, or the AI Replies tab's own prompt if their sync isn't
  authorised) before the bot can read or send anything for them - an
  existing OAuth connection doesn't retroactively gain new scopes.
- **Webhook URL** - `https://labhq.co/api/app-webhook`, already live (it
  was a stub before this). Register it on the Launchpad Sync app's
  Marketplace listing if it isn't already, subscribed to at least
  `InboundMessage` events. Every other event type is acked and ignored.
- **How it works** - `app/api/app-webhook/route.js` verifies GHL's
  `X-GHL-Signature` header, resolves which tenant owns the webhook's
  `locationId` (scans `deployments` the first time, then caches the
  mapping in the `location-tenant-index` store), and hands off to the
  Netlify Background Function `netlify/functions/bot-reply-background.mjs`
  so it can ack GHL immediately. That function calls `lib/bot.js`, which
  re-fetches the actual conversation/messages from GHL with our own token
  before doing anything - the webhook payload's content is never trusted
  directly, only used to look up context.
- **Enabling per client** - client detail page → **AI Replies** tab: an
  on/off toggle, per-channel toggles (SMS/Facebook/Instagram/web chat),
  quiet hours (with timezone), a handoff keyword, and a max-replies-per-
  conversation-per-hour cap. Settings are stored per location in the
  `bot-settings` Blobs store (`lib/botSettings.js`), default `enabled:
  false`. The same tab has a **test chat** that runs the bot's reply
  generation against the client's real business context with no GHL calls
  at all - works for demo-mode tenants with no GHL sub-account too.
- **Classification** - every inbound message is classified as `handoff`,
  `spam`, or `normal` before anything else happens (`lib/bot.js`,
  `classifyInbound`). `handoff` fires when the sender asks for a human or
  uses the configured handoff keyword; the bot tags the contact
  `bot-handoff` in GHL, logs an activity entry, and stops replying to that
  conversation. That pause is stored in the ephemeral `bot-counters` store
  and **auto-expires after 24 hours** as a safety net (there's no way for
  this app to detect a human removing the GHL tag, so it doesn't wait on
  that indefinitely).
- **Guardrails** - every reply is generated from a system prompt that
  includes the same hard compliance guardrails the deploy review screen
  enforces on the phone assistant (`lib/guardrails.js`, shared by both) -
  never claim to be human, always offer a human handoff, never collect
  sensitive details beyond what booking requires - plus a 120-word cap and
  "always end with a clear next step."
- **Activity log** - every inbound message received and every reply sent
  is logged to the tenant's activity feed with `type: "bot_message"`
  (`lib/activity.js`), visible on both the client's Activity tab and the
  AI Replies tab's own "Recent bot activity" list.
- **If a reply doesn't send** - check the function logs for
  `[CONVO-BOT-FAIL]`. A 401 almost always means the location needs
  re-authorising for the new scopes (see above).

## Disaster recovery

Every durable Netlify Blobs store (the full list is `lib/backupStores.js` -
tenants, accounts, deployments, GHL connections, checklists, checklist
templates, branding + assets, activity logs, Mission Control passwords,
team, notifications, claim links, invite codes, snapshot templates, AI
Replies settings, the location→tenant index) is snapshotted daily and kept
for 30 days. Five stores are intentionally excluded because they're
short-lived and self-regenerating: `portal-sessions`, `account-sessions`,
`password-resets`, `rate-limits`, `bot-counters` - losing them just means
someone logs in again (or the AI bot's rate limit/handoff pause resets),
there's nothing to restore.

- **Schedule** - `netlify/functions/backup-blobs.mjs`, a Netlify Scheduled
  Function, cron `0 17 * * *` (17:00 UTC = 03:00 AEST next day; Queensland
  doesn't observe daylight saving, so this stays fixed at UTC+10 year-round -
  if that ever changes, update the cron expression).
- **Where it goes** - Netlify Blobs, store `backups`, key
  `backup/YYYY-MM-DD.json.gz` (gzip-compressed JSON). Encrypted values
  (`ghl-connections`, `accounts`) are captured as raw bytes and never
  decrypted - they stay encrypted at rest in the snapshot exactly as they
  were live.
- **Retention** - 30 daily snapshots; older ones are pruned automatically at
  the end of every backup run (`pruneSnapshots` in `lib/backup.js`).
- **Manual backup** - `/admin` -> Backups -> "Back up now" runs the same
  export immediately (`POST /api/admin/backups`). Both scheduled and manual
  runs log an entry to `/admin/activity`.
- **Viewing snapshots** - `/admin` -> Backups lists every snapshot with its
  date, trigger, key count, and size. `netlify blobs:list backups` works too
  for a raw look.

### Restoring

Restores are CLI-only by design - there is no restore button in the admin
console, so a wrong click there can never overwrite live data.

```bash
# See what's available
node scripts/restore-backup.mjs --list

# See what would change, without writing anything
node scripts/restore-backup.mjs --date 2026-07-14 --dry-run
node scripts/restore-backup.mjs --date 2026-07-14 --store tenants --dry-run

# Restore for real (prints the same diff, then asks you to type "yes")
node scripts/restore-backup.mjs --date 2026-07-14
node scripts/restore-backup.mjs --date 2026-07-14 --store tenants

# Skip the confirmation prompt (e.g. scripted recovery)
node scripts/restore-backup.mjs --date 2026-07-14 --yes
```

By default, restoring only **adds and overwrites** keys from the snapshot -
it never deletes anything, even if the snapshot is missing a key that
exists live now. That's the right default for the normal disaster-recovery
case (data went missing or got corrupted; anything created since the
snapshot should survive). If you actually need an exact point-in-time
rollback - live data matches the snapshot exactly, including deleting
anything created after it - add `--delete-extraneous`; the dry run will
show you exactly what that would delete before you commit to it.

Needs `NETLIFY_API_TOKEN` (a personal access token from
`app.netlify.com/user/applications`) in `.env.local` or the shell
environment - the script talks to the Blobs API directly with an explicit
site ID + token rather than relying on Netlify's ambient function context,
since it runs as a plain `node` process. The site ID comes from
`NETLIFY_SITE_ID` if set, otherwise from the linked `.netlify/state.json`
(same file the Netlify CLI itself uses for this project).

## Launch-day runbook (Sunday)

1. `npm run test:ghl` ✅
2. OBM's first client opens `obm.labhq.co`, does the chat (or you drive it screen-shared)
3. Review screen → tidy anything → Deploy
4. In GHL: confirm sub-account, connect client's calendar (OAuth) + phone number
5. Test call to Mia → fix wording in custom values if needed → go live
6. Invoice: activate the $249/mo subscription. 🚀
