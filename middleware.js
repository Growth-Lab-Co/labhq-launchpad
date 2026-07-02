import { NextResponse } from "next/server";
import { TENANTS } from "./lib/tenants";

const ROOT_HOSTS = ["labhq.co", "www.labhq.co"];
const MARKETING_URL = "https://growthlabco.com.au/labhq";

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

  // Bare labhq.co -> marketing page
  if (ROOT_HOSTS.includes(host) && url.pathname === "/") {
    return NextResponse.redirect(MARKETING_URL);
  }

  // Subdomain routing: obm.labhq.co/* -> /obm/*
  const sub = host.split(".")[0];
  if (!ROOT_HOSTS.includes(host) && TENANTS[sub]) {
    const first = url.pathname.split("/")[1];
    if (first !== sub) {
      const rewritten = url.clone();
      rewritten.pathname = `/${sub}${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(rewritten);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
