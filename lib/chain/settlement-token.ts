export type TokenVerificationStatus =
  | "VERIFIED"
  | "PROVISIONALLY VERIFIED"
  | "UNRESOLVED"
  | "REJECTED"
  | "NOT_AVAILABLE";

export interface SettlementTokenRecord {
  address: `0x${string}` | null;
  symbol: string | null;
  decimals: number | null;
  status: TokenVerificationStatus;
  verifiedAt: string | null;
  evidence: string[];
}

export const CANDIDATE_BOT_USDT_ADDRESS =
  "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C";

export const BOT_USDT: SettlementTokenRecord = {
  address: CANDIDATE_BOT_USDT_ADDRESS,
  symbol: "USDT",
  decimals: 6,
  status: "VERIFIED",
  verifiedAt: "2026-08-17",
  evidence: [
    "Official BOT Chain developer documentation (dev-docs.botchain.ai/docs/Bridge/contract-addresses) lists 0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C as 'USDT (BOT Chain)' - the USDT token contract on BOT Chain Mainnet (Chain ID 677).",
    "Live on-chain reads on BOT Mainnet RPC (2026-08-17): code present, name()='Tether USD', symbol()='USDT', decimals()=6, totalSupply()=58,960,200.",
    "Total supply 58,960,200 exactly matches the circulating supply CoinGecko and BingX report for 'BOT Chain Bridged USDT (BOT Chain)'.",
    "Official BOT Bridge docs confirm USDT is the only currently supported bridged asset (Ethereum/BNB/Tron).",
    "BOT Scan's explorer token page displays conflicting metadata ('Stub Token (goerli) (STUB)'); recorded as an explorer display artifact because the BOT team's own documentation and live on-chain reads agree.",
  ],
};

export type VerifiedSettlementToken = SettlementTokenRecord & {
  status: "VERIFIED";
  address: `0x${string}`;
  decimals: number;
};

export const CANDIDATE_BOT_TESTNET_USDT_ADDRESS =
  "0x75edC9335175Fc0552D51D48439F229c10420fe3";

export const BOT_TESTNET_SETTLEMENT_TOKEN: SettlementTokenRecord = {
  address: CANDIDATE_BOT_TESTNET_USDT_ADDRESS,
  symbol: "USDT",
  decimals: 6,
  status: "VERIFIED",
  verifiedAt: "2026-08-17",
  evidence: [
    "Official BOT Chain developer documentation (dev-docs.botchain.ai/docs/Bridge/contract-addresses) lists 0x75edC9335175Fc0552D51D48439F229c10420fe3 as 'USDT (BOT Chain Testnet)' on BOT Chain Testnet (Chain ID 968).",
    "Live on-chain reads on BOT Testnet RPC (2026-08-17): code present, name()='Tether USD', symbol()='USDT', decimals()=6.",
    "Testnet assets are staging-only and have no economic value; testnet addresses must never be copied into Mainnet configuration.",
  ],
};

export function isUsableSettlementToken(
  token: SettlementTokenRecord,
): token is VerifiedSettlementToken {
  return (
    token.status === "VERIFIED" &&
    token.address !== null &&
    token.decimals !== null
  );
}