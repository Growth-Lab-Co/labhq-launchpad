import { NextResponse } from "next/server";
import { resolvePortalSession } from "@/lib/portalSession";
import { getAccountById, publicAccount } from "@/lib/accounts";

// Who-am-I - the portal UI calls this on load to decide signed-in state.
// Tenant identity always comes from the session record, never a URL param.
export async function GET(req) {
  const session = await resolvePortalSession(req);
  if (!session) return NextResponse.json({ account: null });

  const account = await getAccountById(session.accountId);
  if (!account) return NextResponse.json({ account: null });

  return NextResponse.json({ account: publicAccount(account) });
}
