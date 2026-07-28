import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { listEmailFailures } from "@/lib/emailFailures";

const DAY_MS = 24 * 60 * 60 * 1000;

// Backs the /admin red banner (site-wide, works even if email sending
// itself is down - it's just a Blobs read) and the miia-signups badge.
export async function GET(req) {
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

  const failures = await listEmailFailures({ sinceMs: DAY_MS });
  return NextResponse.json({ failures });
}
