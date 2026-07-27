import { Suspense } from "react";
import { CheckoutSuccessPage } from "@/components/miia/CheckoutSuccessPage";

export const metadata = {
  title: "Setting up your space — Miia",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CheckoutSuccessPage />
    </Suspense>
  );
}
