import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { listAdminActivity } from "@/lib/adminActivity";

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

  const entries = await listAdminActivity();
  return NextResponse.json({ entries });
}
