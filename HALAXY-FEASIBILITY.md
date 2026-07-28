# Halaxy integration - feasibility report

Written 2026-07-28 as part of the overnight build's Phase 3 (3d). Based on
Halaxy's real public developer docs (developers.halaxy.com, support.halaxy.com),
read directly before writing this - nothing here is guessed.

## Is it possible? Yes.

Halaxy exposes a real public API, unlike some practice-management systems
that only offer API access to a handful of blessed partners. It's FHIR-based
(Fast Healthcare Interoperability Resources) - a standardised healthcare data
format, not Halaxy's own bespoke shape like Cliniko's.

## Auth model

- **OAuth 2.0, Client Credentials flow.** A practice generates its own
  Client ID + Client Secret from the Halaxy developer portal - no shared
  Miia-level API key that works across every customer, so every clinic
  connects individually (same shape as Cliniko's per-clinic API key model).
- **Access tokens last 15 minutes**, regardless of the `expires_in: 3600`
  the token endpoint reports - a real gotcha found while reading the docs.
  Any real adapter needs to request a fresh token before effectively every
  call, not cache one for an hour as the response would suggest.
- Required headers: `Authorization: Bearer <token>`, `Accept: application/fhir+json`,
  a `User-Agent` identifying the app (same convention as Cliniko).
- Rate limit: 500 requests/minute - generous, not a practical constraint.

## The real adoption barrier: cost

This is the one that actually matters. Getting an API-capable Client ID/Secret
requires the practice to buy Halaxy's own **API add-on subscription** -
approximately 150 Halaxy credits/month (roughly $33 AUD/month), on top of
whatever they already pay for Halaxy itself. There's a 30-day free trial,
then it's billed.

Cliniko customers paste an API key that's free and already exists for their
account. Every Halaxy customer we'd want to connect first has to go buy an
add-on from Halaxy - a genuine extra cost and an extra step outside our
control, not just an extra field to fill in. This is the single biggest
reason Halaxy is a stub tonight and Cliniko isn't.

## No formal approval process

There's no Halaxy-side app review/approval gate to get through - once a
clinic has bought the add-on, generating credentials is self-serve from
their own account. So the barrier is cost and awareness ("did you know you
need to buy this add-on"), not a waiting-on-Halaxy bottleneck.

## What building the real adapter would involve

1. **FHIR resource mapping** - Practitioner, Schedule/Slot, and Appointment
   are FHIR resources with their own bundle/coding conventions, meaningfully
   more structure to map into the shared adapter interface
   (`lib/integrations/registry.js`) than Cliniko's plainer REST JSON.
2. **Token refresh on (almost) every call** - a thin token-cache wrapper
   that re-authenticates whenever the 15-minute window is close to expiring,
   not a "fetch once, reuse for the hour" pattern.
3. **UI/copy for the add-on requirement** - the Cliniko settings card just
   asks for a pasted key; Halaxy's card needs to explain the add-on
   purchase step first, or the connect attempt will just fail for anyone
   who hasn't bought it yet.
4. **Booking creation** - FHIR's Appointment resource create flow needs
   its own verification pass (which fields are genuinely required, how a
   Patient resource is found-or-created) the same way this build verified
   Cliniko's individual_appointments shape - not yet done for Halaxy.

## Estimated effort

Roughly the same order of work as the Cliniko adapter (a working day or two
of focused build+test time for a competent dev already familiar with this
codebase), plus extra time for FHIR-shape verification and the token-refresh
wrapper. Not a bigger architectural lift - `lib/integrations/registry.js`'s
shared interface already accommodates it - just more surface area per method
than Cliniko needed.

## What shipped tonight instead

- `lib/integrations/halaxy.js` - stubbed behind the exact same interface as
  the real Cliniko adapter, so nothing else in the app needs to know it
  isn't real yet. Every method returns an honest "in progress" result.
- The practice-software connect card shows Halaxy as **"Halaxy integration:
  in progress, register interest"** with a click that files an ops note -
  never a fake connected state, never a broken connect flow.
