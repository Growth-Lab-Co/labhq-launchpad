import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/mcAuth";
import { listActivity } from "@/lib/activity";

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const key = req.headers.get("x-mc-key");
  if (!(await verifyPassword(tenant, key))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const entries = await listActivity(tenant);
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
