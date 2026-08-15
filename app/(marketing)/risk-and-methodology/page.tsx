import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { InteriorHero } from "@/components/brand/interior-hero";
import { SectionHeading } from "@/components/brand/section-heading";
import { FinalCta } from "@/components/brand/final-cta";

export const metadata: Metadata = {
  title: "Risk and methodology",
  description: "Understand what Nostos makes visible, what remains subject to issuers and asset terms, and why settlement estimates are not guarantees.",
};

const visible = [
  "The source and timestamp of displayed yield information",
  "Issuer, backing, fees, minimums and eligibility information when available",
  "The stated settlement window and whether it is estimated or confirmed",
  "Redemption request IDs and explicit state transitions",
  "Available pool capacity, the disclosed discount and the quoted net amount",
  "BOT Chain transaction and settlement records when published",
];

const notGuaranteed = [
  "The underlying asset’s yield, backing or issuer performance",
  "An exact settlement arrival time",
  "Instant liquidity for every redemption request",
  "Eligibility for every user or every asset",
  "That visibility removes market, issuer, contract or operational risk",
];

export default function RiskAndMethodologyPage() {
  return (
    <>
      <InteriorHero
        eyebrow="Risk and methodology"
        title="No financial infrastructure is risk-free."
        description="Nostos makes the queue, settlement terms, liquidity capacity and transaction history more visible so users can make a better-informed decision."
      />
      <Section>
        <Container className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="What Nostos makes visible" title="The terms should be inspectable." />
            <ul className="mt-10 border-t border-[var(--ink)]">
              {visible.map((item) => <li key={item} className="border-b border-[var(--line)] py-5 text-sm leading-6">{item}</li>)}
            </ul>
          </div>
          <div className="rounded-card bg-[#f7f5f1] p-7 sm:p-10">
            <SectionHeading eyebrow="What Nostos does not guarantee" title="Visibility is not certainty." />
            <ul className="mt-10 border-t border-[var(--ink)]">
              {notGuaranteed.map((item) => <li key={item} className="border-b border-[var(--line)] py-5 text-sm leading-6 text-[var(--muted)]">{item}</li>)}
            </ul>
          </div>
        </Container>
      </Section>
      <Section className="border-y border-[var(--ink)] bg-[var(--blue)]">
        <Container>
          <SectionHeading
            eyebrow="How to read settlement information"
            title="Estimated means estimated. Confirmed means recorded."
            description="A settlement window describes the current expectation; it is not a guaranteed arrival time. A state becomes confirmed only when the relevant process or transaction has completed."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { title: "Pending", text: "The underlying settlement has not completed. The request remains recorded." },
              { title: "Claimable", text: "Settlement is available and the user can take the stated next action." },
              { title: "Claimed", text: "The claim action has completed and its transaction or receipt can be inspected." },
            ].map((state) => (
              <article key={state.title} className="rounded-card border border-[var(--ink)] bg-white p-6">
                <p className="eyebrow">Settlement state</p>
                <h3 className="display mt-10 text-2xl font-bold tracking-[-.03em]">{state.title}</h3>
                <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{state.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </Section>
      <Section>
        <Container className="grid gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <SectionHeading eyebrow="Responsibility boundaries" title="Separate the asset from the infrastructure." />
          <div className="border-t border-[var(--ink)] pt-7">
            <p className="text-pretty text-lg leading-8">Nostos provides the queue and liquidity layer. The underlying asset’s yield, eligibility and settlement remain subject to its issuer and terms.</p>
            <p className="mt-6 text-sm leading-7 text-[var(--muted)]">Users should review issuer documentation, asset terms, eligibility requirements, contract risk and the conditions attached to any liquidity quote before taking action.</p>
          </div>
        </Container>
      </Section>
      <FinalCta
        eyebrow="Visible terms"
        title="Understand what you are entering—and how you may leave."
        description="Explore selected vault interfaces with risk, terms and settlement information placed in the open."
      />
    </>
  );
}
