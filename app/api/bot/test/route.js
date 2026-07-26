import { NextResponse } from "next/server";
import { resolveMcAuth } from "@/lib/mcBridge";
import { getDeployment } from "@/lib/deployments";
import { getBotSettings } from "@/lib/botSettings";
import { generateReply, classifyInbound } from "@/lib/bot";

function authorized(req, tenant) {
  return resolveMcAuth(req, tenant);
}

// POST /api/bot/test - Mission Control's "AI Replies" test chat. Runs the
// same classify+generate logic as a real inbound message, seeded entirely
// from client-side conversation state - no GHL calls (no send, no history
// fetch), so this works for demo-mode tenants with no GHL sub-account too.
export async function POST(req) {
  try {
    const { tenant, deploymentId, messages = [], inboundText } = await req.json();
    if (!(await authorized(req, tenant))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!deploymentId || !inboundText) {
      return NextResponse.json({ error: "Missing deploymentId or inboundText" }, { status: 400 });
    }

    const deployment = await getDeployment(deploymentId, tenant);
    if (!deployment) return NextResponse.json({ error: "Deployment not found" }, { status: 404 });

    const settings = await getBotSettings(tenant, deployment.locationId || deploymentId);
    const category = await classifyInbound({ text: inboundText, handoffKeyword: settings.handoffKeyword });
    const reply =
      category === "normal" ? await generateReply({ deployment, messages, inboundText }) : null;

    return NextResponse.json({ category, reply });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
