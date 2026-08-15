import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { Container } from "@/components/ui/container";
import { LinkButton } from "@/components/ui/button";

import styles from "./marketing.module.css";

export function PaperPeelFeature() {
  return (
    <section className={styles.peelSection} aria-labelledby="peel-title">
      <Container className={styles.peelStage}>
        <div className={styles.paperBoard}>
          <article className={styles.paperSheet}>
            <div className={styles.paperCopy}>
              <p className="eyebrow">The opaque exit, made visible</p>
              <h2 id="peel-title" className="display text-balance text-4xl font-bold leading-[.98] tracking-[-.045em] sm:text-5xl">
                Your redemption should not disappear.
              </h2>
              <p className={styles.paperDescription}>
                Nostos turns an opaque redemption delay into explicit states and a visible request record.
              </p>
              <LinkButton href="/how-it-works" variant="default" size="lg" className={styles.featureCta}>
                See how it works <ArrowRight size={16} aria-hidden="true" />
              </LinkButton>
            </div>
            <Image className={styles.paperCurl} src="/images/feature/paper-curl.webp" alt="" aria-hidden="true" width={520} height={520} />
          </article>

          <div className={styles.boardContent}>
            <div className={styles.boardCopy}>
              <h3 className="display text-balance text-3xl font-semibold leading-[1.02] tracking-[-.04em] sm:text-4xl">
                Track the wait. Keep the option.
              </h3>
              <p>
                Pending, claimable and claimed stay visible from request to receipt.
              </p>
            </div>

            <div className={styles.noteBoard} aria-label="Settlement state examples">
              <div className={`${styles.stickyNote} ${styles.pinkNote}`} data-testid="fold-pending">
                <Image className={styles.pushpin} src="/images/feature/pushpin.webp" alt="" aria-hidden="true" width={320} height={320} />
                <span>PENDING</span>
                <small>Request recorded</small>
              </div>
              <div className={`${styles.stickyNote} ${styles.yellowNote}`} data-testid="fold-claimable">
                <Image className={styles.paperclip} src="/images/feature/paperclip.webp" alt="" aria-hidden="true" width={360} height={360} />
                <span>CLAIMABLE</span>
                <small>Next action visible</small>
              </div>
              <div className={styles.receiptNote} data-testid="fold-receipt">
                <span className="eyebrow">PUBLIC RECORD</span>
                <strong>CLAIMED</strong>
                <small>Settlement leaves a receipt</small>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
