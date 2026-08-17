# Nostos Environment Lifecycle

Testnet is staging. Mainnet is production. The hackathon final deployment target is BOT Mainnet.

```
LOCAL
  |
  v
BOT TESTNET (968)
  |
  v
Functional deployment + transaction proof
  |
  v
BOT Mainnet gas-support application
  |
  v
BOT MAINNET (677)
```

## Rules

- Network selection is always explicit. There is no automatic switching and no `if mainnet fails -> use testnet` fallback.
- Testnet addresses must never be copied into Mainnet configuration.
- Mainnet addresses must never be copied into Testnet configuration.
- Transaction hashes must always be accompanied by their chain identity (mainnet = 677 / scan.botchain.ai, testnet = 968 / scan.bohr.life).
- Testnet tBOT has no economic value and is not BOT Mainnet currency.
- Canonical config: `lib/chain/bot-mainnet.ts` and `lib/chain/bot-testnet.ts`.
- Provenance: `lib/chain/provenance.ts` (`BOT_MAINNET_PROVENANCE`, `BOT_TESTNET_PROVENANCE`).

## Faucet

Testnet tBOT is claimed manually at https://faucet.botchain.ai/basic (up to 10 tBOT per address per 24 hours). Do not automate claiming.

## Known Infrastructure Notes (BOT Testnet)

- `rpc.bohr.life` has been empirically observed returning different Testnet synchronization heights across requests. The same wallet can appear with 10 tBOT on one request and 0 tBOT on the next.
- Explorer-confirmed balances can temporarily disappear through stale RPC backends. If a transaction is confirmed on the explorer at block N, an RPC backend reporting a head below N cannot yet represent that transaction's resulting state.
- Nostos staging diagnostics detect this: `npm run doctor:testnet` reports an `RPC CONSISTENCY` section and classifies `HEALTHY`, `DEGRADED`, or `STALE_BACKENDS_DETECTED`.
- The Testnet write proof (`npm run write-proof:testnet`) uses a bounded idempotent rebroadcast of a single signed raw transaction, so stale-backend `insufficient funds` symptoms are retried safely without duplicate transfers.
- Mainnet must not automatically inherit this behavior unless equivalent evidence is observed there. BOT Chain itself is not labelled unreliable; this documents the exact observed behavior on the public Testnet RPC.

## Frontend (P1)

- The live frontend is explicitly gated to BOT Testnet (968); writes are disabled.
- BOT Mainnet (677) is known internally but cannot activate in the frontend, even if a wallet connects on 677.
- Injected/EIP-1193 wallets only. No WalletConnect in P1.
- Live balances (tBOT, Testnet USDT) are read only when the wallet is on BOT Testnet; failed reads are shown as unavailable, never as zero.
