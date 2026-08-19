import { describe, expect, it } from "vitest";
import {
  isAuthorizedForTicket,
  isP4VaultUsable,
  resolveTicketOwner,
} from "@/lib/chain/ticketed-vault-hooks";

const ALICE = "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";
const BOB = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
const APPROVED = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC";

describe("ticketed vault authorization helpers", () => {
  it("authorizes the current ticket owner", () => {
    expect(isAuthorizedForTicket(ALICE, ALICE, undefined, false)).toBe(true);
    expect(isAuthorizedForTicket(BOB, ALICE, undefined, false)).toBe(false);
  });

  it("authorizes the current token approval and approval-for-all operator", () => {
    expect(isAuthorizedForTicket(APPROVED, ALICE, APPROVED, false)).toBe(true);
    expect(isAuthorizedForTicket(BOB, ALICE, APPROVED, true)).toBe(true);
    expect(isAuthorizedForTicket(BOB, ALICE, undefined, false)).toBe(false);
  });
});

describe("P4 frontend deployment gate", () => {
  it("requires BOT Testnet, a wallet, and both P4 addresses", () => {
    expect(isP4VaultUsable(true, ALICE, "0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222")).toBe(true);
    expect(isP4VaultUsable(false, ALICE, "0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222")).toBe(false);
    expect(isP4VaultUsable(true, undefined, "0x1111111111111111111111111111111111111111", "0x2222222222222222222222222222222222222222")).toBe(false);
    expect(isP4VaultUsable(true, ALICE, undefined, "0x2222222222222222222222222222222222222222")).toBe(false);
  });
});

describe("ticket owner reads", () => {
  it("uses the live ownerOf result for an active request", () => {
    expect(
      resolveTicketOwner(BigInt(7), [
        ...Array.from({ length: 6 }, () => ({ status: "failure" as const })),
        { status: "success" as const, result: BOB },
      ]),
    ).toBe(BOB);
    expect(resolveTicketOwner(BigInt(7), undefined)).toBeUndefined();
  });
});
