import { IndustryPage } from "@/components/miia/IndustryPage";
import { getIndustry } from "@/components/miia/industries";
import { buildIndustryMetadata, buildIndustryFaqJsonLd } from "@/components/miia/industryMeta";

const industry = getIndustry("law-firms");

export const metadata = buildIndustryMetadata(industry);

export default function Page() {
  const jsonLd = buildIndustryFaqJsonLd(industry);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <IndustryPage industry={industry} />
    </>
  );
}
