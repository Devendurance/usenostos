import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "./section-heading";
import styles from "./marketing.module.css";

const steps = [
  { title: "Discover", text: "Compare selected RWA opportunities, their terms and their settlement paths." },
  { title: "Enter", text: "Review the asset, fees, eligibility and expected shares before confirming." },
  { title: "Track", text: "Follow a redemption request through explicit pending, claimable and claimed states." },
  { title: "Choose", text: "Keep standard settlement or consider available instant liquidity at a disclosed discount." },
  { title: "Verify", text: "Inspect the request, state transition and settlement receipt on BOT Chain." },
];

export function Lifecycle({ compact = false }: { compact?: boolean }) {
  return (
    <Section className="bg-[#f7f5f1]">
      <Container>
        <SectionHeading
          eyebrow="The lifecycle"
          title="Yield in. Know the way out."
          description="The delay may be unavoidable. The opacity is not. Nostos keeps each part of the exit legible from request to receipt."
        />
        <ol className={`${styles.lifecycleGrid} ${compact ? styles.lifecycleCompact : ""}`}>
          {steps.map((step, index) => (
            <li key={step.title} className="relative border-t border-[var(--ink)] pt-5">
              <span className="eyebrow text-muted-foreground">0{index + 1}</span>
              <h3 className="display mt-9 text-2xl font-bold tracking-[-.03em]">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
