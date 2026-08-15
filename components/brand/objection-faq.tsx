import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { SectionHeading } from "./section-heading";

const objections = [
  {
    question: "Why not simply sell the token?",
    answer: "Selling the underlying token may expose you to market price movement, slippage or limited liquidity. Nostos gives you a separate choice: keep the standard redemption path or sell the defined pending claim at a disclosed discount when liquidity is available.",
  },
  {
    question: "Is instant cashout free?",
    answer: "No. The discount is the visible cost of receiving liquidity before standard settlement. You see the gross amount, discount and net amount before confirming.",
  },
  {
    question: "Is this risk-free?",
    answer: "No financial infrastructure is risk-free. Nostos makes the queue, settlement terms, liquidity capacity and transaction history more visible so users can make a better-informed decision.",
  },
  {
    question: "What happens if there is no instant liquidity?",
    answer: "The standard settlement path remains available. The interface clearly shows when instant liquidity is unavailable rather than implying that every request can be cashed out immediately.",
  },
  {
    question: "Why BOT Chain?",
    answer: "BOT Chain gives the redemption record a public on-chain home. Nostos uses it to record requests, state changes and settlement receipts rather than keeping the exit experience inside a private issuer dashboard.",
  },
];

export function ObjectionFaq() {
  return (
    <Section className="border-t border-[var(--line)]">
      <Container className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
        <SectionHeading eyebrow="Straight answers" title="Clarity includes the hard questions." />
        <div className="border-t border-[var(--ink)]">
          {objections.map((item) => (
            <details key={item.question} className="group border-b border-[var(--line)] py-1">
              <summary className="display flex min-h-20 cursor-pointer list-none items-center justify-between gap-6 py-4 text-lg font-bold tracking-[-.02em] marker:content-none">
                {item.question}
                <span className="text-2xl font-normal transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="max-w-2xl pb-6 pr-10 text-sm leading-7 text-[var(--muted)]">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
