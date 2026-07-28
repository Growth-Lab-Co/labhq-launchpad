// Cliniko adapter - implements the common interface in registry.js.
//
// Built against Cliniko's real public API docs (docs.api.cliniko.com),
// read 2026-07-28, not guessed:
// - Auth: HTTP Basic, the API key as username, no password
//   (docs.api.cliniko.com - "Authentication").
// - Base URL is shard-specific: https://api.{shard}.cliniko.com/v1 - the
//   shard is the key's suffix (e.g. "...-uk2"), defaulting to au1 for
//   legacy keys with no suffix (docs.api.cliniko.com/guides/urls).
// - Required headers: Accept: application/json, and a User-Agent
//   identifying the app + a contact email, or "future requests may be
//   automatically blocked" (Cliniko's own wording).
// - Rate limit: 200 requests/minute/user; a 429 carries an
//   X-RateLimit-Reset unix-timestamp header.
// - GET /businesses/{id}/practitioners/{id}/appointment_types/{id}/available_times
//   - `from`/`to` are a max-7-day window, `from` can't be in the past.
// - POST /individual_appointments - {appointment_type_id, business_id,
//   patient_id, practitioner_id, starts_at, ends_at} is the minimum set.
// - POST /patients - {first_name, last_name} minimum, plus
//   patient_phone_numbers: [{phone_type, number}] for a contact method.
// - List endpoints wrap results under the resource's own key, e.g.
//   {"practitioners": [...], "total_entries": N, "links": {...}}.
// - Filtering: ?q[]=field:=value (docs.api.cliniko.com's "Filtering Results").

const USER_AGENT = "Miia by Growth Lab Co (hello@growthlabco.com.au)";
const SHARD_RE = /-(\w{2}\d{1,2})$/i;

function baseUrlFor(apiKey) {
  const match = SHARD_RE.exec((apiKey || "").trim());
  const shard = match ? match[1].toLowerCase() : "au1";
  return `https://api.${shard}.cliniko.com/v1`;
}

async function clinikoFetch(apiKey, path, { method = "GET", body } = {}) {
  const url = path.startsWith("http") ? path : `${baseUrlFor(apiKey)}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`Couldn't reach Cliniko - ${e.message}`);
  }

  if (res.status === 429) {
    const resetHeader = res.headers.get("x-ratelimit-reset");
    const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toLocaleTimeString() : null;
    throw new Error(`Cliniko rate limit hit - try again${resetAt ? ` after ${resetAt}` : " shortly"}.`);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.errors?.[0]?.title || data?.error || `Cliniko API error (HTTP ${res.status})`;
    throw new Error(message);
  }
  return data;
}

export async function validateCredentials({ apiKey }) {
  if (!apiKey || !apiKey.trim()) return { ok: false, error: "Paste your Cliniko API key first." };
  try {
    const data = await clinikoFetch(apiKey, "/businesses");
    const business = data.businesses?.[0];
    if (!business) return { ok: false, error: "That key works, but no business was found on this Cliniko account." };
    return {
      ok: true,
      meta: {
        businessId: String(business.id),
        businessName: business.business_name || business.label || "",
      },
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function listPractitioners({ credentials, businessId }) {
  const data = await clinikoFetch(credentials.apiKey, `/businesses/${businessId}/practitioners`);
  return (data.practitioners || [])
    .filter((p) => !p.archived_at)
    .map((p) => ({ id: String(p.id), name: [p.first_name, p.last_name].filter(Boolean).join(" ") || `Practitioner ${p.id}` }));
}

export async function listAppointmentTypes({ credentials }) {
  const data = await clinikoFetch(credentials.apiKey, "/appointment_types");
  return (data.appointment_types || [])
    .filter((t) => !t.archived_at)
    .map((t) => ({ id: String(t.id), name: t.name || `Appointment type ${t.id}`, durationMins: t.duration_in_minutes ?? null }));
}

// Cliniko caps from/to at a 7-day window and won't go into the past - the
// caller (lib/bot.js's booking flow) asks in <=7-day chunks; this just
// enforces the same rule so a wider request fails clearly instead of a
// confusing 400 from Cliniko itself.
export async function getAvailability({ credentials, businessId, practitionerId, appointmentTypeId, fromISO, toISO }) {
  const from = fromISO.slice(0, 10);
  const to = toISO.slice(0, 10);
  const data = await clinikoFetch(
    credentials.apiKey,
    `/businesses/${businessId}/practitioners/${practitionerId}/appointment_types/${appointmentTypeId}/available_times?from=${from}&to=${to}`
  );
  return (data.available_times || []).map((t) => ({
    startISO: t.appointment_start,
    endISO: t.appointment_end || null,
  }));
}

// "New or matched patient, minimum viable fields" - matches on first + last
// name via Cliniko's documented q[] filter syntax, then narrows to a phone
// match client-side if more than one name match comes back (no documented
// server-side filter on nested phone numbers, so this doesn't guess one).
async function findOrCreatePatient({ apiKey, firstName, lastName, phone }) {
  const params = new URLSearchParams();
  if (firstName) params.append("q[]", `first_name:=${firstName}`);
  if (lastName) params.append("q[]", `last_name:=${lastName}`);
  const searchData = firstName || lastName ? await clinikoFetch(apiKey, `/patients?${params.toString()}`) : { patients: [] };
  const matches = searchData.patients || [];

  let match = matches[0] || null;
  if (matches.length > 1 && phone) {
    const byPhone = matches.find((p) => (p.patient_phone_numbers || []).some((n) => (n.number || "").replace(/\D/g, "") === phone.replace(/\D/g, "")));
    match = byPhone || match;
  }
  if (match) return { id: String(match.id), isNew: false };

  const created = await clinikoFetch(apiKey, "/patients", {
    method: "POST",
    body: {
      first_name: firstName || "Unknown",
      last_name: lastName || "Patient",
      ...(phone ? { patient_phone_numbers: [{ phone_type: "Mobile", number: phone }] } : {}),
    },
  });
  return { id: String(created.id), isNew: true };
}

export async function createBooking({ credentials, businessId, practitionerId, appointmentTypeId, startISO, endISO, patient }) {
  try {
    const { id: patientId, isNew } = await findOrCreatePatient({
      apiKey: credentials.apiKey,
      firstName: patient?.firstName,
      lastName: patient?.lastName,
      phone: patient?.phone,
    });

    const appointment = await clinikoFetch(credentials.apiKey, "/individual_appointments", {
      method: "POST",
      body: {
        business_id: businessId,
        practitioner_id: practitionerId,
        appointment_type_id: appointmentTypeId,
        patient_id: patientId,
        starts_at: startISO,
        ends_at: endISO,
        notes: "Booked by Miia (AI front desk).",
      },
    });

    return { ok: true, bookingId: String(appointment.id), mode: "instant", patientCreated: isNew };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
