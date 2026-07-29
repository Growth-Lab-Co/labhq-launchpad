"use client";
import { useEffect } from "react";
import { trackViewContent } from "@/lib/metaPixel";

// A tiny client leaf mountable inside server-rendered pages (AlliedHealthPage,
// IndustryPage) that otherwise have no client boundary of their own.
export function ViewContentTracker({ name }) {
  useEffect(() => {
    trackViewContent({ content_name: name, content_type: "product" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
