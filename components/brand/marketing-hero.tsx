import { ArrowRight, Play } from "lucide-react";

import { HeroFlowScene } from "@/components/brand/hero-flow-scene";
import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";

import styles from "./marketing.module.css";

export function MarketingHero() {
  return (
    <section className={styles.heroSection} aria-labelledby="hero-title">
      <Container className={styles.heroGrid}>
        <HeroFlowScene />

        <div className={styles.heroMessage}>
          <h1 id="hero-title" className={styles.heroTitle}>
            <span><span className="squiggle">Capital</span></span>
            <span>on its way</span>
            <span><span className="squiggle">home</span>.</span>
          </h1>
          <div className={styles.heroSupporting}>
            <p>
              Nostos makes RWA yield easier to enter and safer to leave—with clear redemption tracking and optional instant cashout on BOT Chain.
            </p>
            <div className={styles.heroActions}>
              <LinkButton href="/explore" variant="hero" size="lg" data-testid="hero-primary-cta">
                <span className="relative z-[1]">Explore vaults</span><ArrowRight aria-hidden="true" className="relative z-[1]" />
              </LinkButton>
              <LinkButton href="/how-it-works" variant="quiet" size="lg" className={styles.watchLink}>
                <span className={styles.playIcon}><Play aria-hidden="true" fill="currentColor" /></span>
                How the exit works
              </LinkButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
