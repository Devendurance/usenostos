import { Container } from "@/components/ui/container";

export function InteriorHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="border-b border-[var(--ink)] py-16 sm:py-20 lg:py-28">
      <Container>
        <p className="eyebrow text-muted-foreground">{eyebrow}</p>
        <h1 className="display mt-6 max-w-5xl text-balance text-[clamp(3rem,7vw,6rem)] font-bold leading-[.92] tracking-[-.055em]">{title}</h1>
        <p className="mt-8 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">{description}</p>
      </Container>
    </section>
  );
}
