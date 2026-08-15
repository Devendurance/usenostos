import type { ReactNode } from "react";
import { MarketingHeader } from "@/components/shell/marketing-header";
import { MarketingFooter } from "@/components/shell/marketing-footer";
export default function MarketingLayout({ children }: { children: ReactNode }) { return <><a className="skip-link" href="#main-content">Skip to content</a><MarketingHeader /><main id="main-content">{children}</main><MarketingFooter /></>; }
