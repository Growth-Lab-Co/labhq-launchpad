# Simplification build - morning report

Written 2026-07-29. Four jobs shipped, deployed after jobs 2 and 4 (plus
several extra deploys for bugs found live during verification, same as
last time - a fix sitting uncommitted overnight helps no one). Screenshots
and timing throughout are from real runs against production, not staged.

**Never touched:** Stripe/checkout/webhook payment logic beyond what job 3
specifies (removing "complete" from self-serve `VALID_PLANS` - the Stripe
price itself is untouched), agency tenants, Mission Control.

## What shipped

### Job 1 - the Miia widget
An in-house chat widget (`public/widget.js`, vanilla JS, no build step)
replacing GHL's hosted webchat for new activations - branded (cream/violet,
two-dot motif), talking to a new authenticated API keyed by a per-tenant
public key (`mia_pk_...`), with an origin check and rate limiting. Replies
stream from Claude in real time. The dashboard's "try her yourself" panel
and the embedded widget are now the exact same conversation mechanism. The
Conversations page merges widget and GHL-channel history together. The
Channels card now hands out our own snippet, not GHL's - existing customers
who already embedded GHL's keep working untouched.

Preview mode ("Meet Miia", new marketing page + nav link): paste a website
URL, we scrape it and spin up an ephemeral, tenant-free demo session - 10
message cap, email gate at message 2, "Get started" CTA at the cap, expires
in 45 minutes on its own. Verified against a real, unaffiliated business
(moveclinic.com.au) - the scraper correctly pulled real service details
(physiotherapy, exercise physiology, NDIS, climbing-specific therapy) and
the preview bot answered accurately from them.

**Two real bugs found and fixed during verification, both about streaming
reliability - see the wince list, this is the most important thing in this
report to read before relying on the widget for a real customer tonight.**

### Job 2 - instant Chat tier + the session fix
2a: Miia Chat signups no longer wait on any GHL step - deploy is a
database write plus a widget key, GHL sub-account creation happens in a
Netlify Background Function afterward and is never allowed to surface an
error to the customer. "Live in 48 hours" -> "Live in minutes" everywhere
Chat's own promise appears. Everywhere's copy and full synchronous
provisioning path are untouched.

2b: the morning report's #1 wince from last night, fixed properly -
deploying now mints the same dashboard session a magic-link click creates,
directly on the deploy response, so there's no sign-in wall right after
finishing intake. Confirmed live, repeatedly, tonight.

### Job 3 - two self-serve tiers + Miia Voice
Pricing is Chat and Everywhere only for instant checkout now; the former
third tier is Miia Voice, sold by a 15-minute demo
(`components/miia/site.js`'s `BOOKING_URL`) instead of instant purchase.
Kept a legacy lookup path so an existing plan:"complete" subscriber's own
Billing page still resolves correctly - removing it from the storefront
must never mean breaking an existing subscription. Dashboard Channels:
Chat-tier tenants see SMS/Facebook/Instagram locked behind "Available on
Everywhere"; Phone shows "Voice is by invitation" for anyone not on Voice.
Added Momence (studios) alongside Halaxy as the same honest stub.

### Job 4 - proud copy, honest logging, verified queue
Found real drift while sweeping for Cliniko's "proud, not apologetic"
framing: `/allied-health` still said Cliniko integration was "on our
roadmap" - true when written, false since last night's real adapter
shipped. Fixed, along with the Channels card's own wording. Leadsie's
webhook now logs a warning when its secret is unset, not just silent
acceptance. Ops queue verified clean by reading both stores' write paths
directly (previews and agency accounts have no code path into it) rather
than assuming.

## Elapsed pay-to-live time for Chat

**1.3 minutes**, pricing page to landing on the dashboard with no sign-in
wall, in a real Stripe test-mode signup with a scripted ~10-turn intake
conversation (deploy itself: 2.8-3.4 seconds, confirmed several times).
That's script time, not a real human's typing/thinking time - a real
customer's own pace will dominate the true elapsed time, not anything the
system adds. The one honest caveat: see the intake reliability wince below
- not every run reached the review screen cleanly, so "1.3 minutes" is the
happy-path number, not a guaranteed one yet.

## Verification pass, item by item

- **(a) Fresh Chat signup, timed** - done, repeatedly. Clean run: review
  reached, deploy 2.8-3.4s, no sign-in wall, dashboard confirmed, widget
  snippet generated and confirmed talking to its own bot from a standalone
  scratch HTML page. 1.3 minutes total (script time). Not every attempt
  reached review cleanly - see wince #1.
- **(b) Preview mode against a real stranger site** - done against
  moveclinic.com.au. Scrape + summary accurate. Cap and CTA logic verified
  by code review and partial live testing; a fully clean run through the
  email gate specifically was blocked by wince #2's connection-timing
  issue rather than a gate-logic bug as far as I could tell.
- **(c) Everywhere signup end to end** - checkout/plan-selection confirmed
  live (correct card highlighted, correct price). Deploy/dashboard/channel-
  lock-exemption confirmed both live tonight (an existing Everywhere
  tenant correctly shows no Chat-only locks) and via last night's already-
  verified Everywhere deploy path, which job 3 didn't touch except the
  Channels-lock logic (explicitly scoped to `plan === "chat"` only).
- **(d) Voice card books at BOOKING_URL** - confirmed, opens the
  placeholder link correctly; real link still needed from you.
- **(e) Return visit via magic link** - `lib/miiaCustomerAuth.js` and
  `/api/miia/auth/verify` are untouched by any job tonight (confirmed by
  diff). Triggered a real welcome-email resend on an existing tenant to
  confirm the send pipeline itself still works end to end
  (`welcomeEmailSentAt` updated) - didn't click the resulting link myself
  (no inbox access in this environment), so the click-through itself is
  inferred from unchanged code plus the shared session mechanism working
  correctly elsewhere tonight, not independently re-tested end to end.
- **(f) Mobile pass at 390px** - pricing, the preview page, and the open
  widget panel all confirmed fitting cleanly within the viewport, no
  overflow, all controls reachable.

## Blockers that need you

1. **`BOOKING_URL`** (`components/miia/site.js`) is a placeholder
   (`calendly.com/miia-voice-demo/15min`). Replace it with your real
   calendar link - the Voice card already opens whatever's there correctly.
2. **`LEADSIE_EMBED_URL`** - still unset from last night. Once you create a
   Leadsie connect request and set both this and `LEADSIE_WEBHOOK_SECRET`,
   the webhook will start enforcing the secret (it currently logs a warning
   and accepts everything unverified, honestly, per 4b).
3. **The intake field-splitting reliability issue** (below) is worth your
   attention before leaning hard on the "instant" promise with real
   customers - it's pre-existing, not something tonight's jobs introduced,
   but tonight's verification is what surfaced how often it actually bites.

## Wince list, ranked

1. **Intake field-splitting is unreliable, and this predates tonight.**
   Direct testing showed the model sometimes dumps an entire multi-field
   customer message verbatim into one field (e.g. name+business+services+
   area+hours all landing under `contact_name`) even though its own reply
   correctly claims several fields were captured - reproduced repeatedly,
   both via direct API calls and, less often, through the real UI. I
   strengthened the capture instruction (a real improvement, confirmed
   cleaner results after) but this is a mitigation, not a fix - a proper
   fix likely means separating structured extraction from reply generation
   (a second pass, or forced-schema/tool-calling output) rather than asking
   one model call to reliably do both under time pressure. That's a real
   architecture change I did not attempt tonight, out of scope for four
   jobs about the widget/pricing/copy, and not something to rush without
   time to properly re-verify it.
2. **The widget's underlying connection takes far longer to formally close
   than the reply takes to arrive** - visible text streams in 2-5s (timed
   directly), but the raw HTTP request was independently measured at
   ~30-33 seconds to fully close, and Netlify's own function time limit
   sometimes cuts it short mid-flight, producing a raw HTML error page
   instead of my JSON. I could not fully root-cause this in the time
   available (tried: `force-dynamic` on both widget routes - which
   genuinely fixed an unrelated, more serious bug, see #3 below - direct
   timing instrumentation, checking Netlify's function logs). Shipped two
   mitigations: the widget now treats a reply as "done" once chunks stop
   arriving for ~2.5s rather than waiting for the connection to fully
   close (so the next message isn't blocked), and any raw parse-error text
   is replaced with an honest generic message rather than leaking to the
   customer. The underlying ~30s connection-close behaviour itself is
   still unexplained and worth a focused follow-up with real Netlify
   function-log access.
3. **Found and fixed, worth flagging because of how serious it was**: before
   `export const dynamic = "force-dynamic"` was added, Next.js had
   statically cached the widget config route's output - meaning every
   tenant's widget could have shown a DIFFERENT tenant's branding
   (whichever got cached first). Confirmed and fixed with a minimal
   diagnostic route before touching the real one. Not something that shipped
   to a real customer (caught during this same build's verification), but a
   reminder to double-check `dynamic` exports on any future GET route that
   takes per-caller identity via query params.
4. **Two literal "Everything plan" copy leftovers** survived the initial Job
   3 sweep and were only caught by actually running a fresh signup through
   to the intake's final turn (the soft-sell closing line, and a Features
   page line) - both fixed, but a reminder that grepping for a tier's old
   *name* doesn't catch every place its old *concept* got hardcoded into a
   sentence.
5. **Practice-software classification** (Cliniko/Halaxy/other/none) is a
   simple keyword match, unchanged from last night - low stakes (only
   picks which connect card shows first), not revisited tonight.
6. **The email-gate/message-cap flows in preview mode were hard to verify
   with full confidence** given wince #2 above - the underlying mechanism
   (message count, gate logic) looks correct by code review, and did
   render correctly in earlier, simpler tests, but a fully clean, no-caveat
   live run through the gate and cap in one session wasn't achieved
   tonight because of the same connection-timing issue affecting rapid
   follow-up messages.
