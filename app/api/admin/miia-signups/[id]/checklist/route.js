import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { updateSignupChecklist, getSignupWithStatus } from "@/lib/miiaSignups";

// Manual ticks only - "nothing customer-visible derives from unticked
// items except honest in-progress states" (see lib/miiaSignups.js header).
export async function PATCH(req, { params }) {
  const auth = await verifyAdminRequest(req);
  if (!auth.authorized) {
    if (auth.rateLimited) {
      return NextResponse.json(
        { error: "Too many attempts. Try again shortly." },
        { status: 429, headers: { "retry-after": String(auth.retryAfterSeconds) } }
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { item, value } = await req.json().catch(() => ({}));
  if (!item) return NextResponse.json({ error: "item is required" }, { status: 400 });

  try {
    await updateSignupChecklist(params.id, item, value);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const signup = await getSignupWithStatus(params.id);
  if (!signup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ signup });
}
