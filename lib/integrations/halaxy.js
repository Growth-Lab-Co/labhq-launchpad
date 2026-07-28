// Halaxy adapter - STUBBED, not implemented. Same interface shape as
// registry.js's contract so calling code never has to special-case it, but
// every method returns an honest "not available yet" result rather than a
// fake connected state.
//
// See HALAXY-FEASIBILITY.md at the repo root for the full writeup (auth
// model, real per-practice cost, approval requirements, estimated effort) -
// short version: Halaxy DOES have a real public FHIR-based API
// (developers.halaxy.com, read 2026-07-28), so this is buildable, but each
// customer clinic would need to buy Halaxy's own API add-on
// (~150 credits/month, ~$33 AUD) before Miia could connect to their
// account - a real cost/adoption barrier Cliniko's customers don't have.

const NOT_AVAILABLE = "Halaxy integration is in progress - register your interest and we'll be in touch.";

export async function validateCredentials() {
  return { ok: false, error: NOT_AVAILABLE };
}

export async function listPractitioners() {
  throw new Error(NOT_AVAILABLE);
}

export async function listAppointmentTypes() {
  throw new Error(NOT_AVAILABLE);
}

export async function getAvailability() {
  throw new Error(NOT_AVAILABLE);
}

export async function createBooking() {
  return { ok: false, error: NOT_AVAILABLE };
}
