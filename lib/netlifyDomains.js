// Auto-registers a tenant's {slug}.labhq.co as a Netlify domain alias at
// signup/claim time. DNS itself is already wildcarded (*.labhq.co, added
// 2026-07-10) and covered by Netlify's auto-provisioned wildcard SSL cert,
// so every subdomain already resolves and terminates TLS correctly - the
// one thing still missing per-tenant is Netlify's site-level domain claim,
// which the API refuses to accept as a wildcard ("*.labhq.co" -> "has
// invalid characters"; true wildcard routing needs a Netlify support
// ticket, see DEPLOY.md). This fills that gap per tenant instead. Inert
// until NETLIFY_API_TOKEN is set - the tenant just falls back to the path
// URL (labhq.co/{slug}) until then, same as if this call fails.
const NETLIFY_API = "https://api.netlify.com/api/v1";

export function netlifyDomainsConfigured() {
  return Boolean(process.env.NETLIFY_API_TOKEN && process.env.SITE_ID);
}

async function netlifyFetch(path, options) {
  const token = process.env.NETLIFY_API_TOKEN;
  if (!token) throw new Error("NETLIFY_API_TOKEN is not set");
  const res = await fetch(`${NETLIFY_API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.message || `Netlify API ${path} -> ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// Domain aliases are a flat array on the site resource with no dedicated
// "append" endpoint - every call is read-current-then-replace-whole-array,
// so two signups completing in the same instant can race and one alias can
// clobber the other's addition. Not worth a lock for this app's signup
// volume; a lost alias just means that one tenant falls back to the path
// URL and shows up in the admin console's retry list like any other
// failure.
export async function registerTenantDomainAlias(slug) {
  if (!netlifyDomainsConfigured()) throw new Error("Netlify domain auto-registration isn't configured");
  const siteId = process.env.SITE_ID;
  const hostname = `${slug}.labhq.co`;

  const site = await netlifyFetch(`/sites/${siteId}`, { method: "GET" });
  const aliases = site.domain_aliases || [];
  if (aliases.includes(hostname)) return { alreadyRegistered: true };

  await netlifyFetch(`/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ domain_aliases: [...aliases, hostname] }),
  });
  return { alreadyRegistered: false };
}

// Mirror of registerTenantDomainAlias for tenant removal - same
// read-current-then-replace-whole-array caveat applies.
export async function deregisterTenantDomainAlias(slug) {
  if (!netlifyDomainsConfigured()) return { wasRegistered: false };
  const siteId = process.env.SITE_ID;
  const hostname = `${slug}.labhq.co`;

  const site = await netlifyFetch(`/sites/${siteId}`, { method: "GET" });
  const aliases = site.domain_aliases || [];
  if (!aliases.includes(hostname)) return { wasRegistered: false };

  await netlifyFetch(`/sites/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify({ domain_aliases: aliases.filter((a) => a !== hostname) }),
  });
  return { wasRegistered: true };
}
