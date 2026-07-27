import { Space_Grotesk, Space_Mono } from "next/font/google";
import { ScrollbarTheme } from "@/components/miia/ScrollbarTheme";
import "@/components/miia/tokens.css";

// Minimal counterpart to (marketing)/layout.jsx - same brand tokens and
// fonts, deliberately no Header/Footer. This group is for moments that
// need to feel calm and focused (the post-checkout provisioning screen),
// not framed by nav links and a scrolling footer marquee.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-miia-display",
  display: "swap",
});
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-miia-mono",
  display: "swap",
});

export default function CheckoutLayout({ children }) {
  return (
    <div className={`miia ${display.variable} ${mono.variable}`}>
      <ScrollbarTheme />
      {children}
    </div>
  );
}
