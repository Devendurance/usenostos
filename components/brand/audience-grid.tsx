import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "./section-heading";

const audiences = [
  {
    label: "Treasury operators",
    title: "Earn without losing sight of the way out.",
    text: "Compare the terms, understand the settlement path and keep each pending redemption visible.",
    href: "/explore",
  },
  {
    label: "RWA issuers",
    title: "Give every tokenized asset an exit users can understand.",
    text: "Add explicit request states, predictable next actions and a public record without hiding the underlying asset’s constraints.",
    href: "/for-issuers",
  },
  {
    label: "Liquidity providers",
    title: "A defined claim. A disclosed discount.",
    text: "Assess claim quality, settlement timing, capacity and exposure without relying on an unexplained promise of yield.",
    href: "/for-liquidity-providers",
  },
];

export function AudienceGrid() {
  return (
    <Section>
      <Container>
        <SectionHeading eyebrow="Built for every side of settlement" title="One clear record. Different reasons to rely on it." />
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {audiences.map((audience) => (
            <article key={audience.label} className="flex min-h-96 flex-col rounded-card border border-[var(--ink)] p-7">
              <p className="eyebrow text-muted-foreground">{audience.label}</p>
              <h3 className="display mt-10 text-3xl font-bold leading-[1.05] tracking-[-.04em]">{audience.title}</h3>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">{audience.text}</p>
              <Link href={audience.href} className="mt-auto inline-flex min-h-11 items-center gap-2 pt-8 text-sm font-semibold underline decoration-[var(--lilac)] decoration-2 underline-offset-4">
                Learn more <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
