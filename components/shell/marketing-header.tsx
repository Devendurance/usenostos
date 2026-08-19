"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import styles from "@/components/brand/marketing.module.css";
import { BrandMark } from "@/components/shell/brand-mark";
import { WalletPreviewDialog } from "@/components/shell/wallet-preview-dialog";
import { Container } from "@/components/ui/container";

const links = [
  ["/how-it-works", "How it works"],
  ["/explore", "Explore"],
  ["/for-issuers", "For issuers"],
  ["/for-liquidity-providers", "For liquidity providers"],
  ["/risk-and-methodology", "Risk & methodology"],
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className={styles.marketingHeader}>
      <Container className={styles.headerContainer}>
        <BrandMark />
        <nav className={styles.desktopNav} aria-label="Main navigation">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <WalletPreviewDialog className={styles.headerWallet} triggerVariant="header" />
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={open}
          >
            <Menu size={18} />
          </button>
        </div>
      </Container>

      {open ? (
        <div className={styles.mobileMenuLayer}>
          <button
            type="button"
            className={styles.mobileMenuBackdrop}
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
          />
          <aside className={styles.mobileMenuPanel} aria-label="Mobile menu">
            <div className={styles.mobileMenuTopline}>
              <BrandMark />
              <button
                type="button"
                className={styles.menuButton}
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className={styles.mobileNav} aria-label="Mobile main navigation">
              {links.map(([href, label]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)}>{label}</Link>
              ))}
            </nav>
            <WalletPreviewDialog className={styles.mobileWallet} />
          </aside>
        </div>
      ) : null}
    </header>
  );
}
