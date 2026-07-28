// Pluggable practice-software integrations. Every provider adapter exports
// the same interface, so callers (the Channels/Bookings dashboard, lib/bot.js)
// never branch on which one a tenant uses:
//
//   validateCredentials({ apiKey })
//     -> { ok: true, meta } | { ok: false, error }
//   listPractitioners({ credentials, ...meta })
//     -> [{ id, name }]
//   listAppointmentTypes({ credentials, ...meta })
//     -> [{ id, name, durationMins }]
//   getAvailability({ credentials, ...meta, practitionerId, appointmentTypeId, fromISO, toISO })
//     -> [{ startISO, endISO }]
//   createBooking({ credentials, ...meta, practitionerId, appointmentTypeId, startISO, endISO, patient })
//     -> { ok: true, bookingId, mode: "instant" | "requested" } | { ok: false, error }
//
// `meta` is whatever validateCredentials returned alongside `ok: true` -
// provider-specific context (e.g. Cliniko's businessId) the other methods
// need, persisted on the connection record (lib/integrations/credentials.js)
// so it doesn't have to be re-derived on every call.
//
// A provider not yet built for real (Halaxy - see 3d) still implements this
// same shape so the UI/bot code has nothing special to know about it; its
// methods just return an honest "not available yet" error.

import * as cliniko from "./cliniko.js";
import * as halaxy from "./halaxy.js";

export const PROVIDERS = {
  cliniko: { id: "cliniko", name: "Cliniko", available: true, adapter: cliniko },
  halaxy: { id: "halaxy", name: "Halaxy", available: false, adapter: halaxy },
};

export function getProvider(id) {
  return PROVIDERS[id] || null;
}

export function listProviders() {
  return Object.values(PROVIDERS).map(({ id, name, available }) => ({ id, name, available }));
}
