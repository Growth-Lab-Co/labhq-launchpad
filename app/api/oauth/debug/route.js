import { NextResponse } from "next/server";
import { listConnectionKeys, getConnectionSummary, debugMintLocationToken } from "@/lib/ghlOAuth";

// GET /api/oauth/debug?tenant=growthlab - redacted view of stored OAuth
// connections for diagnosing auth-chain issues. Never returns token values,
// only presence/shape (app, companyId, locationId, expiry). Same auth gate
// as /api/test-deploy.
export async function GET(req) {
  const key = req.headers.get("x-mc-key");
  if (!process.env.MC_PASSWORD || key !== process.env.MC_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenant = req.nextUrl.searchParams.get("tenant") || "growthlab";
  const testMintFor = req.nextUrl.searchParams.get("testMintFor");

  const keys = await listConnectionKeys(tenant);
  const connections = {};
  for (const k of keys) {
    connections[k] = await getConnectionSummary(k);
  }

  const mintTest = testMintFor ? await debugMintLocationToken({ tenant, locationId: testMintFor }) : null;

  return NextResponse.json({ tenant, connections, mintTest });
}
