import "./globals.css";

export const metadata = {
  title: "Lab HQ — powered by Launchpad",
  description: "Your automated onboarding system, deployed through a conversation.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
