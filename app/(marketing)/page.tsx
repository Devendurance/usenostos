import type { Metadata } from "next";
import { MarketingHero } from "@/components/brand/marketing-hero";
import { MessagePillars } from "@/components/brand/message-pillars";
import { PaperPeelFeature } from "@/components/brand/paper-peel-feature";
import { Lifecycle } from "@/components/brand/lifecycle";
import { AudienceGrid } from "@/components/brand/audience-grid";
import { ObjectionFaq } from "@/components/brand/objection-faq";
import { FinalCta } from "@/components/brand/final-cta";
import { LandingReveal } from "@/components/brand/landing-reveal";

export const metadata: Metadata = {
  title: "Capital on its way home",
  description: "Nostos makes RWA yield easier to enter and safer to leave—with clear redemption tracking and optional instant cashout on BOT Chain.",
};

export default function HomePage() {
  return (
    <>
      <MarketingHero />
      <LandingReveal>
        <MessagePillars />
        <PaperPeelFeature />
        <Lifecycle />
        <AudienceGrid />
        <ObjectionFaq />
        <FinalCta />
      </LandingReveal>
    </>
  );
}
