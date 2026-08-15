import { ArrowDownToLine, Eye, Route, ScrollText } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "./section-heading";

const pillars = [
  {
    number: "01",
    title: "Enter clearly",
    text: "See the yield, the terms and the settlement path before you deposit.",
    icon: ArrowDownToLine,
  },
  {
    number: "02",
    title: "See the exit",
    text: "A redemption request should not disappear into a black box.",
    icon: Eye,
  },
  {
    number: "03",
    title: "Keep optionality",
    text: "If timing matters, turn a pending claim into available liquidity.",
    icon: Route,
  },
  {
    number: "04",
    title: "Settle in the open",
    text: "Settlement should leave a record.",
    icon: ScrollText,
  },
];

export function MessagePillars() {
  return (
    <Section>
      <Container>
        <SectionHeading
          eyebrow="The Nostos difference"
          title="See the way out before you enter."
          description="Availability tells you that an asset can be bought. Nostos helps you understand how and when you can leave."
        />
        <div className="mt-12 grid border-l border-t border-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map(({ number, title, text, icon: Icon }) => (
            <article key={title} className="min-h-72 border-b border-r border-[var(--line)] p-6 lg:p-7">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-muted-foreground">{number}</span>
                <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
              </div>
              <h3 className="display mt-20 text-2xl font-bold tracking-[-.03em]">{title}</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
