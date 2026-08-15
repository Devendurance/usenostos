import { ArrowRight, PlayCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";
import styles from "./marketing.module.css";

const states = [
  { label: "PENDING", caption: "Request recorded", className: styles.pendingCard },
  { label: "CLAIMABLE", caption: "Settlement available", className: styles.claimableCard },
  { label: "CLAIMED", caption: "Receipt published", className: styles.claimedCard },
];

export function MarketingHero() {
  return (
    <section className="overflow-hidden border-b border-[var(--line)] py-16 sm:py-20 lg:py-28">
      <Container className={styles.heroGrid}>
        <div className={styles.stateScene} aria-hidden="true">
          <svg className={styles.stateWires} viewBox="0 0 560 440" fill="none">
            <path d="M138 92C213 92 202 203 282 203S370 331 437 331" />
            <path d="M151 316C218 316 214 203 282 203" />
          </svg>
          {states.map((state) => (
            <div key={state.label} className={`hatch-shadow ${styles.stateCard} ${state.className}`}>
              <span className="eyebrow">Settlement state</span>
              <strong className="display mt-5 block text-2xl font-bold tracking-[-.03em]">
                {state.label}
              </strong>
              <span className="mt-2 block text-sm text-[var(--muted)]">{state.caption}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 lg:pl-8">
          <p className="eyebrow text-[var(--muted)]">RWA redemption and settlement infrastructure</p>
          <h1 className="display mt-6 max-w-2xl text-balance text-[clamp(3.25rem,7vw,5.75rem)] font-bold leading-[.91] tracking-[-.055em]">
            <span className="squiggle">Capital</span> on its way <span className="squiggle">home</span>.
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-[var(--muted)]">
            Nostos makes RWA yield easier to enter and safer to leave—with clear redemption tracking and optional instant cashout on BOT Chain.
          </p>
          <div className="mt-9 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <LinkButton href="/explore" offset className="min-w-40">
              Explore vaults <ArrowRight size={17} aria-hidden="true" />
            </LinkButton>
            <LinkButton href="/how-it-works" variant="quiet" className="px-1">
              <PlayCircle size={19} aria-hidden="true" /> How the exit works
            </LinkButton>
          </div>
        </div>
      </Container>
    </section>
  );
}
