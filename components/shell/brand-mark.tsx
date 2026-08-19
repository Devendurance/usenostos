import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  dark?: boolean;
  className?: string;
  priority?: boolean;
};

const WORDMARK_DIMENSIONS = { width: 1484, height: 286 } as const;

export function BrandMark({ dark = false, className, priority = false }: BrandMarkProps) {
  return (
    <Link
      href="/"
      className={cn("inline-flex min-h-11 items-center", className)}
      aria-label="Nostos home"
      data-testid={dark ? "nostos-wordmark-dark" : "nostos-wordmark"}
    >
      <Image
        src={dark ? "/images/brand/nostos-wordmark-dark.png" : "/images/brand/nostos-wordmark.png"}
        alt=""
        width={WORDMARK_DIMENSIONS.width}
        height={WORDMARK_DIMENSIONS.height}
        sizes="(max-width: 767px) 108px, 140px"
        priority={priority}
        className="h-auto w-[clamp(6.75rem,10vw,8.75rem)]"
      />
    </Link>
  );
}
