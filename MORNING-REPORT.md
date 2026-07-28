# Overnight build run - morning report

Written 2026-07-28. Phases 1-3 shipped, deployed to production three times
(once per phase), and verified live against `coastal-physio` plus fresh
Stripe test signups. Everything below is what actually happened - no
placeholder numbers, no fake "connected" states, anywhere.

**Never touched:** Stripe/checkout/webhook payment logic (beyond 1a's
routing/CTA/query-param layer), agency tenants, Mission Control, OAuth
routes. Nothing came close to needing an exception.

## Phase 1 - QA fixes (all six shipped, deployed, verified)

- **1a** - Primary CTA everywhere is "Get started"; scarcity lives in
  banners/eyebrows only. `/get-started` is retired (301s to `/pricing`,
  query string preserved); pricing cards go straight to Stripe with plan
  preselected from the URL. Verified live: the `?vertical=allied-health`
  tag survives signup → Stripe metadata → `healthcareModeSource: "signup"`
  on the tenant, confirmed on two real test signups.
- **1b** - Swept "Mia" out of every intake question and generated string
  for Miia tenants via a `{{assistant}}` placeholder (agency tenants
  legitimately named "Mia" are untouched). Found and fixed a second leak
  during verification: the review screen's field labels are derived from
  the raw data key, and `mia_guardrails` (shared with the GHL snapshot, so
  the key itself can't be renamed) was rendering as "MIA GUARDRAILS" -
  added a label override so only the display text changed.
- **1c** - Chat/Everywhere (non-voice) plans skip the outbound-calls
  question entirely and get a closing line about the Everything plan.
  Verified live via a real signup with plan=everywhere: no voice question
  ever appeared, the soft-sell line appeared verbatim.
- **1d** - Deploy completion is now a ~4s transitional screen with an
  immediate "Go to your dashboard" button, auto-redirecting after 4s -
  agency tenants keep the exact old detailed success screen, byte-for-byte
  (split into its own branch, not threaded through more conditionals).
- **1e** - Every Miia tenant page was silently falling through to the root
  layout's hardcoded "Lab HQ — powered by Launchpad" title and LabHQ
  favicon - confirmed via live curl that marketing pages were never
  affected, only `/[tenant]/*`. Fixed with a real Miia favicon set
  (32/180/512, generated from `public/miia-app-icon.png`) and
  `"Miia | {business name}"` titles, scoped to `productType === "miia"`
  only.
- **1f** - `pw-welcome-email-verify-706924` archived (confirmed 404 on its
  public URL afterward).

## Phase 2 - Channel plumbing (all three shipped, deployed, verified)

- **2a** - The Channels page's embed card was calling a route that
  live-fetched a GHL Forms embed (a contact-form iframe, not a chat
  widget) and required data-sync auth Miia tenants generally don't have -
  it silently returned an empty card. HighLevel's real chat-widget embed
  only needs the location's ID (verified against their support docs) - no
  extra OAuth scope needed - so it's now generated deterministically and
  can never come back empty. Ships with Copy + a new "Email this to my web
  person" mailto.
- **2b** - healthcareMode tenants get a new opt-in intake question for
  their booking-system link; every Miia tenant can also edit it from the
  Bookings dashboard page. **Bug found and fixed during verification**: the
  interview model occasionally captured an unrelated later answer against
  this field once it became "the next uncaptured one" - harmless for prose
  fields, worse here since it's offered as a live link. Now validated
  (must contain a real URL) with a fallback extraction from booking_rules,
  confirmed fixed on a second live test run.
- **2c** - Was never built (confirmed via a full-codebase grep before
  starting - genuinely skipped, not stubbed). Read Leadsie's real docs
  before writing anything: the webhook payload shape is confirmed from
  their own literal example, and **their docs document no signature/secret
  verification mechanism at all** - stated in code comments rather than
  inventing one, with an opt-in `?secret=` mitigation available. The embed
  code itself isn't published anywhere - it's generated per-account inside
  Leadsie's dashboard - so `LEADSIE_EMBED_URL` is a plain constant left
  blank, showing an honest "not wired up yet" state until it's set.

## Phase 3 - Calendars + practice software (the big one)

- **3a** - `lib/integrations/` - one interface every provider implements
  (`validateCredentials`, `listPractitioners`, `listAppointmentTypes`,
  `getAvailability`, `createBooking`). Credentials encrypted at rest with
  the same AES-256-GCM helper already used for GHL tokens (reused as-is).
- **3c - Cliniko: full adapter, real availability, booking as a REQUEST.**
  Built directly against Cliniko's real API docs (shard-specific base
  URLs, Basic auth, required headers, the 7-day availability window, the
  documented minimum fields for patients and appointments). The customer
  pastes a key on the Channels page card; it's validated live. **Bug found
  and fixed during verification**: the shard-extraction regex was a loose
  pattern match instead of checked against Cliniko's real, complete shard
  list, so a garbage key could build a dead hostname and surface a
  confusing "fetch failed" instead of an honest "invalid key" - fixed and
  reverified live (a fake key now correctly returns "Cliniko API error
  (HTTP 401)"). The bot offers real availability from a connected account
  when asked about booking. **Level shipped for the write path**: the
  documented fallback, not an instant write. When a customer confirms one
  of the real offered times, it's filed as a booking-request ops task
  (activity log + email to ops with the exact time/patient details), never
  an automatic `createBooking` call. This was a deliberate call, not a
  shortfall: reliably parsing "which exact time did they just confirm" out
  of freeform chat is genuinely ambiguous, and a wrong auto-parsed booking
  is worse for the business than a human confirming it minutes later.
- **3d - Halaxy: honest feasibility report + stub.** Full writeup in
  `HALAXY-FEASIBILITY.md`. Short version: it's real and buildable (OAuth2
  client-credentials, FHIR-based, generous rate limit), but **every
  customer clinic would need to buy Halaxy's own API add-on
  (~150 credits/month, ~$33 AUD)** before we could ever connect to their
  account - a real cost barrier Cliniko doesn't have. That's the actual
  reason this is a stub tonight, not a time shortfall. The stub implements
  the identical interface as the real Cliniko adapter and the UI shows
  "Halaxy integration: in progress, register interest" - never a fake
  connect flow.
- **3b - Google Calendar: honestly blocked, not faked.** Grepped the whole
  codebase before starting - confirmed no Google OAuth app exists anywhere
  (no client ID/secret, no consent screen, no route - only prose mentions
  in copy). The premise that "the platform's existing Google Calendar
  OAuth capability" could be reused was false; building a real one needs a
  Google Cloud project and consent screen only the account holder can
  create. Shipped the honest fallback: a Calendar card that files an ops
  task on click, plus a one-line Outlook roadmap mention.
- **3e** - healthcareMode tenants now get one more opt-in intake question
  (which practice software they use), classified and stored on
  `tenant.practiceSoftware` - drives which connect card the Channels page
  shows first. Verified live on the final fresh signup: answering "we use
  Cliniko" correctly set `practiceSoftware: "cliniko"` and the Channels
  page showed Cliniko's card first.
- **3f** - `coastal-physio` backfilled with `practiceSoftware: "cliniko"`.
  No real Cliniko account exists to test a genuine "connected" state
  against, so the card correctly shows its pre-connection state (API key
  input, help link) - confirmed live, screenshot in the commit history.

## Blockers that need you specifically

1. **Leadsie**: create a Facebook+Instagram "connect request" in your own
   Leadsie account, copy its embed URL, and paste it into
   `LEADSIE_EMBED_URL` in `components/dashboard/ChannelsPageClient.jsx`.
   Also configure the webhook URL in Leadsie's dashboard as
   `https://meetmiia.com/api/leadsie-webhook` (optionally with
   `?secret=<value>` matching a `LEADSIE_WEBHOOK_SECRET` env var, for the
   mitigation described in 2c above).
2. **Google Calendar**: needs a Google Cloud project, OAuth consent
   screen, and a client ID/secret set as env vars before a real connect
   flow can be built - none of that exists yet, and I can't create it for
   you. Until then, clicks on "Connect your calendar" file an ops task.
3. **Halaxy**: not fixable in code - each interested customer clinic needs
   to buy Halaxy's own API add-on first. Full detail in
   `HALAXY-FEASIBILITY.md`.
4. **Orphaned GHL sub-account for coastal-physio**: verifying 1d/2b/3e
   required using the `reset-deploy` admin escape hatch on
   `coastal-physio` and re-running its intake for real, which (correctly,
   by design) created a *new* GHL sub-account on redeploy. The old
   location (`HA6DKpqMuZNNJ9gysQac`) is now orphaned in GHL - worth
   deleting or archiving there if you don't need it.
5. **Cliniko adapter's happy path is verified against real docs and a real
   rejection, not a real success.** I don't have a genuine Cliniko trial
   account, so the "invalid key → honest error" path is confirmed live,
   but the "valid key → real practitioners/availability/booking" path is
   verified by careful reading of the docs and code review, not a live
   successful connection. Worth a real test with an actual Cliniko trial
   account before leaning on it hard with a paying customer.

## Wince list, ranked

1. **Post-deploy, the customer has to sign in again via magic link, in the
   same browser, right after finishing intake.** The dashboard redirect
   (1d) lands on the real dashboard route, but that route's own auth gate
   doesn't know about the session that was just live during intake, so it
   shows the email-based sign-in screen instead of walking straight in.
   Not a regression from tonight - this is how the dashboard's auth was
   already built - but it's the roughest edge in the whole flow and worth
   a deliberate fix, not a rushed one.
2. **Cliniko's booking-confirmation detection adds a second Claude call
   per turn once a tenant is connected** (one for the reply, one to check
   whether they just confirmed a specific time) - fine for the low volume
   a new tenant has, worth watching if Cliniko-connected tenants scale up.
3. **`buildBookingContext` always re-fetches practitioners + appointment
   types + availability from Cliniko on every single inbound message** for
   a connected tenant - no caching. Cliniko's rate limit (200/min) makes
   this a non-issue at today's volume, but it's the first thing to add
   caching to if that ever changes.
4. **Practice-software classification (3e) is a simple keyword match**
   ("contains cliniko" / "contains halaxy" / "none" / else "other") - fine
   for the real test signups tonight, but a customer who says something
   like "we used to use Cliniko but switched to something else" would
   misclassify. Low stakes (it only picks which card shows first; the
   customer can still connect the other one).
5. **No UI to disconnect a practice-software connection once set** - only
   connect. Not asked for tonight, flagging for later.

## What was verified live vs. by code review

Everything in Phases 1 and 2, and 3a/3c's connect-and-reject path, 3e, and
3f were exercised against production with real Stripe test checkouts, real
signups, and screenshots (four full signups total, all archived
afterward). 3c's real-availability-in-chat and booking-request-filing
logic, and 3b/3d's ops-task-filing buttons, were verified by direct
interaction (clicking, checking the resulting UI state) but not against a
real connected Cliniko account or a real Leadsie/Google webhook call, since
none of those external accounts exist yet - see the blockers above.
