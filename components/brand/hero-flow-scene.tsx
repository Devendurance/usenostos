"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ArrowDownToLine, Check, FileCheck2, WalletCards } from "lucide-react";

import styles from "./marketing.module.css";

export function HeroFlowScene() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const nodes = scene.querySelectorAll<HTMLElement>("[data-flow-node]");

    if (!reduced) {
      gsap.fromTo(
        nodes,
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.1, ease: "power2.out", clearProps: "opacity,transform" },
      );
    }

    if (reduced || touch) return;

    const onPointerMove = (event: PointerEvent) => {
      const bounds = scene.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      gsap.to(nodes, { x: x * 4, y: y * 4, duration: 0.5, ease: "power2.out", overwrite: true });
    };
    const reset = () => gsap.to(nodes, { x: 0, y: 0, duration: 0.7, ease: "power2.out", overwrite: true });

    scene.addEventListener("pointermove", onPointerMove);
    scene.addEventListener("pointerleave", reset);
    return () => {
      scene.removeEventListener("pointermove", onPointerMove);
      scene.removeEventListener("pointerleave", reset);
      gsap.killTweensOf(nodes);
    };
  }, []);

  return (
    <div ref={sceneRef} className={styles.flowCollage} data-testid="hero-flow-scene" aria-hidden="true">
      <div className={`${styles.flowCard} ${styles.walletCard}`} data-flow-node="wallet">
        <div className={styles.cardHeading}>
          <span className={styles.iconDisc}><WalletCards /></span>
          <span><strong>Wallet</strong><small>Not connected</small></span>
        </div>
        <div className={styles.cardRule} />
        <span className={styles.cardMeta}>Access</span>
        <strong className={styles.cardState}>PREVIEW ONLY</strong>
      </div>

      <div className={`${styles.flowCard} ${styles.termsCard}`} data-flow-node="terms">
        <span className={styles.cardMeta}>Vault terms</span>
        <strong className={styles.queueTitle}>Verification pending</strong>
        <div className={styles.termsRows}>
          <span>Backing <b>Unavailable</b></span>
          <span>Settlement <b>To be verified</b></span>
        </div>
      </div>

      <div className={`${styles.flowCard} ${styles.requestCard}`} data-flow-node="request">
        <div className={styles.cardHeading}>
          <span className={styles.iconDiscDark}><ArrowDownToLine /></span>
          <span><strong>Redemption request</strong><small>Exit path is visible</small></span>
        </div>
        <div className={styles.cardRule} />
        <span className={styles.cardMeta}>Current state</span>
        <strong className={styles.cardState}>PENDING</strong>
      </div>

      <div className={`${styles.flowCard} ${styles.receiptCard}`} data-flow-node="receipt">
        <div className={styles.receiptIdentity}>
          <span className={styles.receiptAvatar}><Check /></span>
          <span><strong>Settlement record</strong><small>Registry pending</small></span>
        </div>
        <div className={styles.receiptFooter}><span>Public record</span><FileCheck2 /></div>
      </div>

      <span className={styles.flowLineOne} />
      <span className={styles.flowLineTwo} />
      <span className={styles.flowLineThree} />
    </div>
  );
}
