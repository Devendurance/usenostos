import { formatUnits } from "viem";

export type ReadPhase = "idle" | "loading" | "ready" | "unavailable";

export interface ReadStateInput {
  isPending?: boolean;
  isFetched?: boolean;
  isError?: boolean;
}

// A failed read is "unavailable", never "ready". Zero is only a valid ready
// value when the chain actually returned it.
export function deriveReadState(info: ReadStateInput): ReadPhase {
  if (info.isError) return "unavailable";
  if (!info.isFetched) return info.isPending ? "loading" : "idle";
  return "ready";
}

// When a read is not enabled (e.g., the wallet is on the wrong network),
// never surface a previously cached value: it is suppressed as "idle".
export function deriveEnabledReadState(
  enabled: boolean,
  info: ReadStateInput,
): ReadPhase {
  if (!enabled) return "idle";
  return deriveReadState(info);
}

export function formatTokenAmount(
  units: bigint | undefined,
  decimals: number,
): string | null {
  if (units === undefined) return null;
  return formatUnits(units, decimals);
}