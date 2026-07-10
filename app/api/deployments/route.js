import { NextResponse } from "next/server";
import { listDeployments, updateDeploymentStatus, DEPLOYMENT_STATUSES } from "@/lib/deployments";
import { resolveMcAuth } from "@/lib/mcBridge";
import { logActivity } from "@/lib/activity";

const STATUS_LABELS = {
  deployed: "Deployed",
  calendar_connected: "Calendar connected",
  phone_live: "Phone live",
  qa_passed: "QA passed",
  live: "Live",
};

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
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

    await logActivity({
      tenant,
      deploymentId: id,
      businessName: record.businessName,
      type: status === "live" ? "go-live" : "setup",
      text: status === "live" ? "Marked as live" : `Status set to ${STATUS_LABELS[status] || status}`,
    });

    return NextResponse.json({ deployment: record });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
