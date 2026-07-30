"use client";
import Script from "next/script";

// Miia's own chat widget, on Miia's own marketing site - the floating
// launcher (bottom-right) and panel are entirely self-contained inside
// widget.js once it loads; this only needs to load the script.
// strategy="lazyOnload" defers it to browser idle time so it never competes
// with the page's own initial paint/interactivity - see this component's
// only mount point, app/(marketing)/layout.jsx, for why that layout (and no
// other) is the structurally-safe place for this: it wraps every marketing
// page and none of the (checkout) group's pages, so the widget is never
// present during the post-payment provisioning handoff by construction.
const WIDGET_KEY = "mia_pk_98fbbf3d681e72c50eb36b488041398e";

export function MiiaWidgetEmbed() {
  return <Script src="https://meetmiia.com/widget.js" data-miia-key={WIDGET_KEY} strategy="lazyOnload" />;
}
