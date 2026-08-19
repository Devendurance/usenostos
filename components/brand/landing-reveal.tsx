"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

type LandingRevealProps = {
  children: ReactNode;
};

/**
 * Reveals the landing page sections as they enter the viewport.
 *
 * This stays as a client island so the rest of the marketing page remains
 * server-rendered. The observer only decides when a section is visible; GSAP
 * handles the one-shot compositor-friendly opacity/transform tween.
 */
export function LandingReveal({ children }: LandingRevealProps) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    (_context, contextSafe) => {
      const root = scope.current;
      if (!root) return;

      const targets = Array.from(root.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );

      if (
        targets.length === 0 ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof IntersectionObserver === "undefined"
      ) {
        return;
      }

      gsap.set(targets, {
        opacity: 0,
        y: 28,
        willChange: "transform, opacity",
      });

      const animate = (target: HTMLElement) => {
        gsap.to(target, {
          opacity: 1,
          y: 0,
          duration: 0.72,
          ease: "power3.out",
          overwrite: true,
          clearProps: "opacity,transform,willChange",
        });
      };
      const reveal = contextSafe ? contextSafe(animate) : animate;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            reveal(entry.target as HTMLElement);
            observer.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
      );

      targets.forEach((target) => observer.observe(target));

      return () => {
        observer.disconnect();
        gsap.killTweensOf(targets);
      };
    },
    { scope, dependencies: [] },
  );

  return (
    <div ref={scope} data-testid="landing-reveal-scope">
      {children}
    </div>
  );
}
