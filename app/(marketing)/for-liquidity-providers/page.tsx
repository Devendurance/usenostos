import type { Metadata } from "next";
import { BadgeDollarSign, Clock3, Layers3, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { InteriorHero } from "@/components/brand/interior-hero";
import { SectionHeading } from "@/components/brand/section-heading";
import { FeatureList } from "@/components/brand/feature-list";
import { FinalCta } from "@/components/brand/final-cta";

export const metadata: Metadata = {
  title: "For liquidity providers",
  description: "Assess defined RWA settlement claims through disclosed discounts, visible timing, pool capacity and public records.",
};

const providerFeatures = [
  { title: "Defined claim", text: "The pending redemption remains represented as a clear claim with an explicit ownership path.", icon: ShieldCheck },
  { title: "Visible settlement timing", text: "Expected timing is shown as an estimate and remains distinct from a confirmed settlement.", icon: Clock3 },
  { title: "Disclosed discount", text: "The cost of speed is visible to the seller before the claim is transferred.", icon: BadgeDollarSign },
  { title: "Capacity and exposure", text: "Pool capacity, claim eligibility and issuer exposure should be visible rather than implied.", icon: Layers3 },
];

export default function ForLiquidityProvidersPage() {
  return (
    <>
      <InteriorHero
        eyebrow="For liquidity providers and market makers"
        title="Buy a defined settlement claim—not an unexplained promise of yield."
        description="Nostos gives available liquidity a structured role in the redemption path while keeping claim quality, expected settlement, capacity and exposure visible."
      />
      <Section>
        <Container>
          <SectionHeading
            eyebrow="The liquidity opportunity"
            title="The discount is disclosed. The underlying wait is not disguised."
            description="When a pool has capacity, an eligible pending claim can be transferred in exchange for available liquidity. The pool receives the underlying settlement later."
          />
          <div className="mt-12"><FeatureList items={providerFeatures} /></div>
        </Container>
      </Section>
      <Section className="bg-[var(--ink)] text-white">
        <Container className="grid gap-10 lg:grid-cols-[1fr_.85fr] lg:items-center">
          <div>
            <p className="eyebrow text-white/55">Before a claim is purchased</p>
            <h2 className="display mt-5 max-w-3xl text-balance text-4xl font-bold leading-[1.02] tracking-[-.045em] sm:text-5xl">Know what is defined—and what remains uncertain.</h2>
          </div>
          <ul className="space-y-0 border-t border-white/30 text-sm leading-6 text-white/72">
            {[
              "Claim representation and ownership path",
              "Estimated settlement timing",
              "Discount and purchase terms",
              "Pool capacity and issuer exposure",
              "On-chain request and receipt records",
            ].map((item) => <li key={item} className="border-b border-white/20 py-4">{item}</li>)}
          </ul>
        </Container>
      </Section>
      <Section>
        <Container className="max-w-4xl text-center">
          <p className="eyebrow text-[var(--muted)]">A conditional path</p>
          <h2 className="display mt-5 text-balance text-4xl font-bold leading-[1.02] tracking-[-.045em]">Available liquidity is an option, not a guarantee.</h2>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-[var(--muted)]">When there is no eligible liquidity, the standard settlement path remains intact. Nostos shows that condition directly rather than implying that every request can be purchased.</p>
        </Container>
      </Section>
      <FinalCta
        eyebrow="Nostos Instant"
        title="Track the wait. Keep the option."
        description="Explore the pool interface and the information available around pending settlement claims."
      />
    </>
  );
}
