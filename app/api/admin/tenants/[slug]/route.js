import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { removeTenant } from "@/lib/tenantDeletion";

// Full tenant teardown - see lib/tenantDeletion.js for exactly what gets
// deleted. Requires the caller to echo the tenant slug back as confirmSlug
// (the admin UI enforces this by requiring it typed into a text field
// before the button enables; this is the server-side half of that same
// check, in case anything ever calls this route directly).
export async function DELETE(req, { params }) {
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

  const slug = params.slug;
  const { confirmSlug } = await req.json().catch(() => ({}));
  if (confirmSlug !== slug) {
    return NextResponse.json({ error: "Confirmation text doesn't match the tenant slug" }, { status: 400 });
  }

  try {
    const result = await removeTenant(slug);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
