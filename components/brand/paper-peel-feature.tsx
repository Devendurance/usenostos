import { Container } from "@/components/ui/container";
import styles from "./marketing.module.css";

export function PaperPeelFeature() {
  return (
    <section className={`relative overflow-hidden py-20 text-white sm:py-24 lg:py-28 ${styles.peelSection}`}>
      <div className={styles.paperCurl} aria-hidden="true" />
      <Container className={styles.peelGrid}>
        <div className="relative z-10 max-w-2xl">
          <p className="eyebrow text-white/65">The opaque exit, made visible</p>
          <h2 className="display mt-5 text-balance text-4xl font-bold leading-[.98] tracking-[-.045em] sm:text-5xl lg:text-6xl">
            Your redemption should not disappear.
          </h2>
          <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-white/72">
            A user should know whether a request is pending, claimable or settled. They should know the expected settlement window, the cost of leaving early and whether available liquidity can purchase the pending claim.
          </p>
        </div>

        <div className={styles.noteBoard} aria-hidden="true">
          <svg className={styles.noteWire} viewBox="0 0 500 360" fill="none">
            <path d="M62 78C161 79 118 269 243 269S335 102 447 102" />
          </svg>
          <div className={`${styles.stickyNote} ${styles.pinkNote}`}>
            <span>PENDING</span>
            <small>Request recorded</small>
          </div>
          <div className={`${styles.stickyNote} ${styles.yellowNote}`}>
            <span>CLAIMABLE</span>
            <small>Next action visible</small>
          </div>
          <div className={styles.receiptNote}>
            <span className="eyebrow">PUBLIC RECORD</span>
            <strong>CLAIMED</strong>
            <small>Settlement leaves a receipt</small>
          </div>
        </div>
      </Container>
    </section>
  );
}
