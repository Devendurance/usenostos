import type { Metadata } from "next";
import { CheckCircle2, Clock3, Eye, ReceiptText } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { InteriorHero } from "@/components/brand/interior-hero";
import { Lifecycle } from "@/components/brand/lifecycle";
import { SectionHeading } from "@/components/brand/section-heading";
import { FeatureList } from "@/components/brand/feature-list";
import { FinalCta } from "@/components/brand/final-cta";

export const metadata: Metadata = {
  title: "How it works",
  description: "See how Nostos turns delayed RWA redemptions into visible, trackable and optionally liquid claims.",
};

const visibleStates = [
  { title: "Request recorded", text: "Every redemption receives a request ID and an explicit pending state.", icon: ReceiptText },
  { title: "Estimate identified", text: "The expected settlement window remains clearly labelled as an estimate, not a guarantee.", icon: Clock3 },
  { title: "Next action visible", text: "The interface distinguishes pending, claimable and claimed states and tells the user what comes next.", icon: Eye },
  { title: "Receipt inspectable", text: "Important state transitions and settlement records have a public home on BOT Chain.", icon: CheckCircle2 },
];

export default function HowItWorksPage() {
  return (
    <>
      <InteriorHero
        eyebrow="How it works"
        title="The delay may be unavoidable. The opacity is not."
        description="Nostos connects a visible asynchronous queue with a controlled instant-liquidity path and records important state transitions on BOT Chain."
      />
      <Lifecycle compact />
      <Section>
        <Container>
          <SectionHeading
            eyebrow="See the exit"
            title="A redemption request should not disappear into a black box."
            description="Users should know where their capital is, when it may settle and what action is available at each stage."
          />
          <div className="mt-12"><FeatureList items={visibleStates} /></div>
        </Container>
      </Section>
      <Section className="border-y border-[var(--ink)] bg-[var(--forest)] text-white">
        <Container>
          <SectionHeading
            inverse
            eyebrow="Two paths"
            title="Wait with visibility, or leave early when liquidity is available."
            description="Standard settlement preserves the full eligible amount after the underlying process completes. Instant cashout lets an eligible pending claim be sold at a disclosed discount when a prefunded pool has capacity."
          />
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <article className="rounded-card border border-white/25 bg-white p-7 text-[var(--ink)]">
              <p className="eyebrow text-[var(--muted)]">Standard settlement</p>
              <h3 className="display mt-8 text-3xl font-bold tracking-[-.04em]">Keep the claim. Track the wait.</h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--muted)]">Receive the eligible amount after the underlying settlement completes. The estimate remains visible throughout the queue.</p>
            </article>
            <article className="rounded-card border border-white/25 bg-[var(--sticky-yellow)] p-7 text-[var(--ink)]">
              <p className="eyebrow">Instant cashout</p>
              <h3 className="display mt-8 text-3xl font-bold tracking-[-.04em]">Transfer the claim. See the cost first.</h3>
              <p className="mt-4 max-w-lg text-sm leading-6 text-black/70">Sell the pending claim to available liquidity. The gross amount, discount and net amount are shown before confirmation.</p>
            </article>
          </div>
          <p className="mt-7 max-w-3xl text-sm leading-6 text-white/65">Instant liquidity is conditional on eligibility and pool capacity. The standard settlement path remains available when instant liquidity is not.</p>
        </Container>
      </Section>
      <FinalCta title="See the yield. Know the exit." />
    </>
  );
}
