import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { listSignups } from "@/lib/miiaSignups";

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

  const includeArchived = req.nextUrl.searchParams.get("includeArchived") === "true";
  const signups = await listSignups({ includeArchived });
  return NextResponse.json({ signups });
}
