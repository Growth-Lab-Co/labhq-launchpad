import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/mcAuth";
import { getChecklistProgressBulk } from "@/lib/checklist";

// GET /api/checklist/progress?tenant=&ids=a,b,c - batch progress lookup for
// the Clients table, so it isn't one request per row.
export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const idsParam = req.nextUrl.searchParams.get("ids") || "";
  const key = req.headers.get("x-mc-key");
  if (!(await verifyPassword(tenant, key))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ids = idsParam.split(",").filter(Boolean);
  try {
    const progress = await getChecklistProgressBulk(tenant, ids);
    return NextResponse.json({ progress });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
