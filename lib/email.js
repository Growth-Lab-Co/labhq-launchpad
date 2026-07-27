// Minimal Resend wrapper - raw fetch to their HTTP API rather than adding a
// dependency. Never throws: callers get { ok, error } and decide how to
// surface a failed send (e.g. keep an invite record even if the email
// didn't go out).

const RESEND_API_URL = "https://api.resend.com/emails";

// `from` is an optional per-call override - callers outside LabHQ's own
// invite-email flow (e.g. Miia) MUST pass their own `from`, never rely on
// RESEND_FROM_EMAIL, since that's LabHQ's default and shared across every
// caller of this function.
export async function sendEmail({ to, subject, html, text, from: fromOverride }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromOverride || process.env.RESEND_FROM_EMAIL || "Lab HQ <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "Email isn't configured yet - add RESEND_API_KEY to send real invites." };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.message || `Email provider error (${res.status})` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
