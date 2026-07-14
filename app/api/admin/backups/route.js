import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { runBackup, listSnapshots } from "@/lib/backup";
import { logAdminActivity } from "@/lib/adminActivity";

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

  const snapshots = await listSnapshots();
  return NextResponse.json({ snapshots });
}

// Manual "Back up now" trigger. Runs the same export as the scheduled
// function, synchronously - the admin console waits for it to finish so it
// can show the resulting snapshot immediately.
export async function POST(req) {
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

  try {
    const result = await runBackup({ trigger: "manual" });
    await logAdminActivity({
      action: "backup_completed",
      detail: { key: result.key, totalKeys: result.totalKeys, sizeBytes: result.sizeBytes, trigger: "manual" },
    });
    return NextResponse.json({ result });
  } catch (e) {
    console.error("[admin/backups] manual backup failed:", e.message);
    return NextResponse.json({ error: "Backup failed. Check function logs." }, { status: 500 });
  }
}
