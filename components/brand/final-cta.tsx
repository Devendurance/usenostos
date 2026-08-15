import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";

export function FinalCta({
  eyebrow = "The clear exit for tokenized assets",
  title = "Before you deposit, see the way out.",
  description = "Explore selected RWA opportunities with the settlement path placed alongside the yield and terms.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className="border-t border-[var(--ink)] bg-[var(--lilac)] py-16 sm:py-20">
      <Container className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display mt-4 text-balance text-4xl font-bold leading-[.98] tracking-[-.045em] sm:text-5xl">{title}</h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-black/70">{description}</p>
        </div>
        <LinkButton href="/explore" variant="hero" size="lg" className="w-fit min-w-44" data-testid="final-explore-cta">
          Explore vaults <ArrowRight size={17} aria-hidden="true" />
        </LinkButton>
      </Container>
    </section>
  );
}
