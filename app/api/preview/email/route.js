import { NextResponse } from "next/server";
import { getPreviewSession, setPreviewEmail } from "@/lib/previewSessions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The preview's email gate (job 1) - unlocks messages past
// PREVIEW_EMAIL_GATE_AT. Deliberately doesn't send anything or create a
// signup record - just unlocks the ephemeral session. Ops never sees this;
// it's not a lead-capture form wired to anything else tonight (that would
// need explicit thought about consent/marketing-list wiring this build
// doesn't cover - see the morning summary).
export async function POST(req) {
  const { previewId, email } = await req.json().catch(() => ({}));
  if (!previewId || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like a valid email." }, { status: 400 });
  }
  const session = await getPreviewSession(previewId);
  if (!session) return NextResponse.json({ error: "This preview has expired." }, { status: 404 });

  await setPreviewEmail(previewId, email);
  return NextResponse.json({ ok: true });
}
