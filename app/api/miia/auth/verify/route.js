import { NextResponse } from "next/server";
import { consumeMagicLink, createSession, setSessionCookie, cookieDomainForRequest } from "@/lib/miiaCustomerAuth";
import { SITE_URL } from "@/components/miia/site";

// GET, not POST - this is the link a customer clicks straight from their
// email client. Single-use (consumeMagicLink deletes the token on read), so
// a forwarded or re-clicked email link fails safe with a plain error page
// rather than a confusing redirect loop.
export async function GET(req) {
  const token = req.nextUrl.searchParams.get("token");
  const consumed = await consumeMagicLink(token);

  if (!consumed) {
    return new NextResponse(
      "<!doctype html><html><body style=\"font-family:sans-serif;padding:40px;text-align:center;\">" +
        "<p>That sign-in link has expired or was already used. Head back to your dashboard and request a new one.</p>" +
        "</body></html>",
      { status: 400, headers: { "content-type": "text/html" } }
    );
  }

  const { token: sessionToken, expiresAt } = await createSession({ tenantSlug: consumed.tenantSlug });
  const res = NextResponse.redirect(`${SITE_URL}/${consumed.tenantSlug}`);
  return setSessionCookie(res, sessionToken, expiresAt, cookieDomainForRequest(req));
}
