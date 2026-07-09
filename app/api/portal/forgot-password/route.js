import { NextResponse } from "next/server";
import { getAccountByEmail } from "@/lib/accounts";
import { createResetToken } from "@/lib/passwordResets";
import { sendEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function POST(req) {
  const ip = getClientIp(req);
  const { allowed, retryAfterSeconds } = await checkRateLimit({
    route: "forgot-password",
    ip,
    max: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds) } }
    );
  }

  const { email } = await req.json().catch(() => ({}));
  const emailConfigured = Boolean(process.env.RESEND_API_KEY);

  // Always do the same work and return the same message shape regardless of
  // whether the email matches an account, so this endpoint can't be used to
  // enumerate registered agencies.
  const account = await getAccountByEmail(email).catch(() => null);
  if (account) {
    const token = await createResetToken(account.id);
    const link = `${req.nextUrl.origin}/portal/reset-password?token=${token}`;
    await sendEmail({
      to: account.contactEmail,
      subject: "Reset your Lab HQ portal password",
      html: `<p>Reset your password: <a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
      text: `Reset your password: ${link}\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    });
  }

  if (!emailConfigured) {
    return NextResponse.json({
      message: "Password reset emails aren't set up yet. Contact your Lab HQ operator for a reset link.",
    });
  }
  return NextResponse.json({
    message: "If an account exists for that email, we've sent reset instructions.",
  });
}
