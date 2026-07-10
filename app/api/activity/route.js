import { NextResponse } from "next/server";
import { resolveMcAuth } from "@/lib/mcBridge";
import { listActivity } from "@/lib/activity";

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await resolveMcAuth(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const entries = await listActivity(tenant);
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
