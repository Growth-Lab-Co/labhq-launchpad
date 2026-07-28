import { getSignupByTenantSlug } from "@/lib/miiaSignups";
import { getMonthlyUsage } from "@/lib/dashboardData";
import { getPlan, FOUNDING_DISCOUNT } from "@/components/miia/plans";
import { BillingPageClient } from "@/components/dashboard/BillingPageClient";

export default async function BillingPage({ params }) {
  const signup = await getSignupByTenantSlug(params.tenant).catch(() => null);
  const plan = signup?.plan ? getPlan(signup.plan) : null;
  const usage = signup ? await getMonthlyUsage(params.tenant) : null;

  return (
    <BillingPageClient
      tenantSlug={params.tenant}
      plan={plan}
      founding={Boolean(signup?.founding)}
      billingPeriod={signup?.billingPeriod}
      usage={usage}
      hasStripeCustomer={Boolean(signup?.stripeCustomerId)}
      foundingDiscount={FOUNDING_DISCOUNT}
    />
  );
}
