import { NextResponse } from "next/server";
import { getTenant } from "@/lib/tenants";
import {
  ALLOWED_ASSET_TYPES,
  ASSET_TYPES,
  MAX_ASSET_BYTES,
  getBrandingAsset,
  setBrandingAsset,
} from "@/lib/branding";
import { resolveMcAuth } from "@/lib/mcBridge";

// Serves an uploaded favicon/logo directly - public and unauthenticated,
// same as any other static brand asset would be.
export async function GET(req) {
  const tenant = req.nextUrl.searchParams.get("tenant");
  const type = req.nextUrl.searchParams.get("type");
  if (!tenant || !(await getTenant(tenant))) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  if (!ASSET_TYPES.includes(type)) return NextResponse.json({ error: "Unknown asset type" }, { status: 400 });

  try {
    const asset = await getBrandingAsset(tenant, type);
    if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(asset.data, {
      headers: {
        "content-type": asset.contentType,
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const form = await req.formData();
    const tenant = form.get("tenant");
    const type = form.get("type");
    const file = form.get("file");

    if (!tenant || !(await getTenant(tenant))) return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
    if (!ASSET_TYPES.includes(type)) return NextResponse.json({ error: "Unknown asset type" }, { status: 400 });

    if (!(await resolveMcAuth(req, tenant))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (file.size > MAX_ASSET_BYTES) {
      return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
    }
    if (!ALLOWED_ASSET_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File must be an image (PNG, JPEG, SVG, WebP, GIF or ICO)" }, { status: 400 });
    }

    const branding = await setBrandingAsset(tenant, type, file);
    return NextResponse.json(branding);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
