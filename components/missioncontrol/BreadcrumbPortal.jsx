"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Renders into the topbar's #mc-breadcrumb-portal node (see AppShell), so a
// page (e.g. Client detail) can set the breadcrumb without the shell needing
// to know about page-specific routes.
export function BreadcrumbPortal({ children }) {
  const [node, setNode] = useState(null);

  useEffect(() => {
    setNode(document.getElementById("mc-breadcrumb-portal"));
  }, []);

  if (!node) return null;
  return createPortal(children, node);
}
