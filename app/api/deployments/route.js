import { NextResponse } from "next/server";
import { listDeployments, updateDeploymentStatus, DEPLOYMENT_STATUSES } from "@/lib/deployments";
import { verifyPassword } from "@/lib/mcAuth";

async function authorized(req, tenant) {
  const key = req.headers.get("x-mc-key");
  return verifyPassword(tenant, key);
}

export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deployments = await listDeployments(tenant);
    return NextResponse.json({ deployments });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { id, status, tenant } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });
    if (!DEPLOYMENT_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const record = await updateDeploymentStatus(id, status, tenant);
    if (!record) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    return NextResponse.json({ deployment: record });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
