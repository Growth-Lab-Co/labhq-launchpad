import { NextResponse } from "next/server";
import { verifyAdminKey } from "@/lib/adminAuth";
import { getAccountByEmail } from "@/lib/accounts";
import { createResetToken } from "@/lib/passwordResets";

// Operator-generated password reset - the fallback path when
// RESEND_API_KEY isn't set and the self-serve /portal/forgot-password flow
// can't email a link. The operator hands the resulting /portal/reset-
// password?token= link to the agency directly (phone, chat, whatever).
export async function POST(req) {
  if (!verifyAdminKey(req.headers.get("x-mc-key"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json().catch(() => ({}));
  const account = await getAccountByEmail(email);
  if (!account) return NextResponse.json({ error: "No account with that email" }, { status: 404 });

  const token = await createResetToken(account.id);
  return NextResponse.json({ token, agencyName: account.agencyName });
}
