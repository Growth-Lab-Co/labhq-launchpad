import { NextResponse } from "next/server";
import { foundingMode } from "@/lib/miiaStripe";

// Tiny public config endpoint so pricing/get-started can reflect
// MIIA_FOUNDING_MODE without needing a rebuild - the pages themselves stay
// statically prerendered for speed, this one value is fetched client-side.
export async function GET() {
  return NextResponse.json({ foundingMode: foundingMode() });
}
