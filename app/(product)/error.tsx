"use client";
import { useEffect } from "react";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => {}, []); return <main className="py-24"><Container><p className="eyebrow text-[var(--muted)]">Nostos / workspace</p><h1 className="display mt-4 text-4xl font-bold">The workspace needs another pass.</h1><p className="mt-4 max-w-md text-base leading-7 text-[var(--muted)]">Something interrupted this view. Try the route again or return to the gateway.</p><div className="mt-7 flex gap-3"><Button onClick={() => reset()}>Try again</Button><Link href="/explore" className="inline-flex min-h-11 items-center justify-center rounded-control border border-[var(--ink)] px-5 py-3 text-[15px] font-semibold hover:bg-black/[.04]">Explore vaults</Link></div></Container></main>; }
