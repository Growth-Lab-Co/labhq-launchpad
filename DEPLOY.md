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
3. Their subdomain works instantly (wildcard already covers it).

## Launch-day runbook (Sunday)

1. `npm run test:ghl` ✅
2. OBM's first client opens `obm.labhq.co`, does the chat (or you drive it screen-shared)
3. Review screen → tidy anything → Deploy
4. In GHL: confirm sub-account, connect client's calendar (OAuth) + phone number
5. Test call to Mia → fix wording in custom values if needed → go live
6. Invoice: activate the $249/mo subscription. 🚀
