"use client";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ensureFbq, trackPageView } from "@/lib/metaPixel";
import { captureUtm } from "@/lib/utm";

// Mounted once in app/(marketing)/layout.jsx, the one layout wrapping every
// marketing page and no others - see that file's comment for why this is
// the structurally-safe place to load the base pixel (never on customer
// dashboards, tenant pages, /admin, or the intake chat, by construction,
// not by a runtime check).
export function MetaPixel({ pixelId }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRun = useRef(true);

  useEffect(() => {
    if (!pixelId) return;
    ensureFbq(pixelId);
    captureUtm();
    trackPageView();
    firstRun.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (firstRun.current || !pixelId) return;
    trackPageView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!pixelId) return null;
  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
