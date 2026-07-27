import { redirect } from "next/navigation";

// Thin hand-off from the Miia marketing site's /get-started page into the
// product's real signup entry point. Kept separate from app/portal/* so the
// signup flow itself stays untouched — this just forwards the plan choice.
export default function StartPage({ searchParams }) {
  const plan = searchParams?.plan;
  redirect(plan ? `/portal?plan=${encodeURIComponent(plan)}` : "/portal");
}
