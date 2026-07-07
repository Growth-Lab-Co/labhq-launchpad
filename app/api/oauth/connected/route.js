import { NextResponse } from "next/server";

function escapeHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// GET /api/oauth/connected - the simple confirmation page the OAuth callback
// redirects to once a connection is stored (or failed). Not tenant-branded;
// whoever drove the connect flow just needs to see it worked.
export async function GET(req) {
  const { searchParams } = req.nextUrl;
  const ok = searchParams.get("ok") !== "0";
  const app = searchParams.get("app") || "";
  const tenant = searchParams.get("tenant") || "";
  const locationId = searchParams.get("locationId") || "";
  const reason = searchParams.get("reason") || "";

  const appLabel = app === "agency" ? "Agency" : app === "location" ? "Location" : app || "App";
  const title = ok ? "Connected" : reason === "no_portal_state" ? "Connect from your portal instead" : "Connection failed";
  const body = ok
    ? `<p>${escapeHtml(appLabel)} app connected${tenant ? ` for <strong>${escapeHtml(tenant)}</strong>` : ""}${
        locationId ? ` (location ${escapeHtml(locationId)})` : ""
      }.</p><p>You can close this tab.</p>`
    : reason === "no_portal_state"
    ? `<p>We couldn't tell which account this install belongs to.</p><p>If you clicked "Install" directly from the GHL Marketplace listing page, please go back to your Launchpad portal and use the Connect link there instead - that's what lets us match the connection to your account.</p>`
    : `<p>Something went wrong connecting the ${escapeHtml(appLabel)} app${
        tenant ? ` for <strong>${escapeHtml(tenant)}</strong>` : ""
      }.</p>${reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : ""}`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${title} - Launchpad</title>
<style>body{font:16px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#222}</style>
</head>
<body>
<h1>${title}</h1>
${body}
</body>
</html>`;

  return new NextResponse(html, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
