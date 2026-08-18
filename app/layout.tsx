import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Web3Providers } from "@/components/providers/web3-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const generalSans = localFont({ variable: "--font-general-sans", display: "swap", src: [
  { path: "../public/fonts/GeneralSans-Regular.woff", weight: "400", style: "normal" },
  { path: "../public/fonts/GeneralSans-Medium.woff", weight: "500", style: "normal" },
  { path: "../public/fonts/GeneralSans-Semibold.woff", weight: "600", style: "normal" },
  { path: "../public/fonts/GeneralSans-Bold.woff", weight: "700", style: "normal" },
] });
export const metadata: Metadata = {
  title: { default: "Nostos — Capital on its way home", template: "%s — Nostos" },
  description: "Nostos is the redemption and settlement layer for tokenized real-world assets.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={cn("font-sans", inter.variable, generalSans.variable)}><body><Web3Providers>{children}</Web3Providers></body></html>;
}
