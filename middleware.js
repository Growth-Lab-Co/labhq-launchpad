import { NextResponse } from "next/server";

const ROOT_HOSTS = ["labhq.co", "www.labhq.co"];
const ROOT_SUFFIX = ".labhq.co";

// Whether a slug is a real tenant is decided downstream (getTenant() + a 404
// in app/[tenant]/{layout,page}.jsx) - middleware only needs to know this
// host is one of ours before rewriting, so it stays synchronous with no
// Blobs dependency. The ROOT_SUFFIX check is required: without it this would
// also rewrite Netlify's own *.netlify.app preview domain.
export function middleware(req) {
  const url = req.nextUrl;
  const host = (req.headers.get("host") || "").split(":")[0];

  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next") ||
    url.pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Subdomain routing: obm.labhq.co/* -> /obm/*
  if (!ROOT_HOSTS.includes(host) && host.endsWith(ROOT_SUFFIX)) {
    const sub = host.slice(0, -ROOT_SUFFIX.length);
    const first = url.pathname.split("/")[1];
    if (sub && first !== sub) {
      const rewritten = url.clone();
      rewritten.pathname = `/${sub}${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(rewritten);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
