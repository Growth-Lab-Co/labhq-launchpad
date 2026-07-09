import { NextResponse } from "next/server";
import { getTenant, slugAvailable, validateSlug } from "@/lib/tenants";

// Live subdomain validation while typing in the signup form. Unauthenticated
// on purpose - a slug's availability isn't sensitive.
export async function GET(req) {
  const slug = String(req.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();

  if (!slug) return NextResponse.json({ available: false, reason: "Enter a subdomain" });
  if (!validateSlug(slug)) {
    return NextResponse.json({
      available: false,
      reason: "Use lowercase letters, numbers and hyphens only",
    });
  }
  if (!slugAvailable(slug)) {
    return NextResponse.json({ available: false, reason: "That subdomain is reserved" });
  }
  const existing = await getTenant(slug);
  if (existing) {
    return NextResponse.json({ available: false, reason: "That subdomain is already in use" });
  }
  return NextResponse.json({ available: true });
}
