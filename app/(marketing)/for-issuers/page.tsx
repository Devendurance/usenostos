import type { Metadata } from "next";
import { Blocks, Eye, FileCheck2, Waypoints } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { InteriorHero } from "@/components/brand/interior-hero";
import { SectionHeading } from "@/components/brand/section-heading";
import { FeatureList } from "@/components/brand/feature-list";
import { FinalCta } from "@/components/brand/final-cta";

export const metadata: Metadata = {
  title: "For RWA issuers",
  description: "Give every tokenized asset a redemption experience users can understand with visible queues, claim states and settlement records.",
};

const issuerFeatures = [
  { title: "Visible request states", text: "Replace a generic processing message with explicit pending, claimable and claimed states.", icon: Eye },
  { title: "Reusable queue infrastructure", text: "Give asynchronous redemptions a consistent request record and a clear next action.", icon: Waypoints },
  { title: "Optional liquidity path", text: "Present available instant liquidity as a conditional choice, with the discount and claim transfer made explicit.", icon: Blocks },
  { title: "Public settlement record", text: "Make request IDs, state transitions and settlement receipts inspectable on BOT Chain.", icon: FileCheck2 },
];

export default function ForIssuersPage() {
  return (
    <>
      <InteriorHero
        eyebrow="For RWA issuers and asset managers"
        title="Give every tokenized asset an exit users can understand."
        description="Nostos provides the queue and liquidity layer. The underlying asset’s yield, eligibility and settlement remain subject to its issuer and terms."
      />
      <Section>
        <Container className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
          <SectionHeading
            eyebrow="The issuer problem"
            title="Credibility is tested at redemption."
            description="The challenge is not simply offering a tokenized asset. It is maintaining user confidence when the real-world settlement process takes time."
          />
          <div className="rounded-[var(--radius-card)] bg-[var(--blue)] p-7 sm:p-10">
            <p className="eyebrow">What users need to believe</p>
            <ul className="display mt-9 space-y-5 text-2xl font-bold leading-tight tracking-[-.03em]">
              <li>The queue is understandable.</li>
              <li>The next action is visible.</li>
              <li>The record can be inspected.</li>
              <li>The underlying constraints are not hidden.</li>
            </ul>
          </div>
        </Container>
      </Section>
      <Section className="bg-[#f7f5f1]">
        <Container>
          <SectionHeading
            eyebrow="Issuer infrastructure"
            title="A consistent exit layer without pretending settlement is instant."
            description="Nostos makes timing, terms and state transitions legible while leaving asset-specific yield, backing and eligibility with the issuer."
          />
          <div className="mt-12"><FeatureList items={issuerFeatures} /></div>
        </Container>
      </Section>
      <Section>
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow text-[var(--muted)]">A better redemption experience</p>
            <h2 className="display mt-4 text-balance text-4xl font-bold leading-[1.02] tracking-[-.045em]">Let the record carry the authority.</h2>
          </div>
          <p className="text-pretty text-lg leading-8 text-[var(--muted)]">Show the request ID, state transition and BOT Chain transaction. Do not ask users to rely on vague status updates or unsupported safety claims.</p>
        </Container>
      </Section>
      <FinalCta
        eyebrow="Nostos for issuers"
        title="Build confidence into the way capital comes home."
        description="Explore the product experience and see how visible redemption infrastructure changes the issuer relationship."
      />
    </>
  );
}
