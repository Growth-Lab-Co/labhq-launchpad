import { NextResponse } from "next/server";
import { listDeployments, updateDeploymentStatus, DEPLOYMENT_STATUSES } from "@/lib/deployments";

function authorized(req) {
  const key = req.headers.get("x-mc-key");
  return Boolean(key) && Boolean(process.env.MC_PASSWORD) && key === process.env.MC_PASSWORD;
}

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = req.nextUrl.searchParams.get("tenant");
  try {
    const deployments = await listDeployments(tenant);
    return NextResponse.json({ deployments });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    if (!DEPLOYMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const record = await updateDeploymentStatus(id, status);
    if (!record) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    return NextResponse.json({ deployment: record });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
