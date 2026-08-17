# Left Off

## Current Task
P1 patch complete: external-wallet chain detection regression fixed. Actual wallet chain id is now read directly from the connected EIP-1193 provider, so unsupported external chains (Celo, Ethereum, Base, 677) correctly trigger BOT TESTNET REQUIRED and block stale balances.

## Completed In This Session
- Confirmed root cause: `useBotNetwork` used wagmi `useChainId()` (configured-chain state), which stays 968 for chains outside `config.chains`.
- Added `lib/chain/use-actual-wallet-chain.ts`: `parseChainId` + `useActualWalletChain` hook using `useSyncExternalStore`; reads `eth_chainId` from the connector provider and subscribes to `chainChanged` with proper cleanup on connector/account change and unmount.
- Updated `lib/chain/frontend-hooks.ts`: `useBotNetwork` gates on `actualChainId === 968`; balance hooks use `deriveEnabledReadState` and suppress cached data while not enabled.
- Added `deriveEnabledReadState` to `lib/chain/read-state.ts` (disabled reads are "idle", never a cached ready value).
- Dialog now keeps the connected address visible in the wrong-network state.
- TDD: added unit tests (`tests/unit/actual-chain.test.ts`) and a fake-EIP-1193 e2e regression (`tests/e2e/nostos.spec.ts`); both failed (RED) before the fix and pass after (GREEN).

## Files Involved
- `lib/chain/use-actual-wallet-chain.ts` (new)
- `lib/chain/frontend-hooks.ts`, `lib/chain/read-state.ts`
- `components/shell/wallet-preview-dialog.tsx`
- `tests/unit/actual-chain.test.ts` (new), `tests/e2e/nostos.spec.ts`

## Verification
- `npm test`: 72 passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm run build`: passed (all routes).
- `npm run test:e2e`: 26 passed (incl. external-switch regression).

## Blockers
- Changes are intentionally uncommitted per instruction.
- Injected-wallet flows still require a real wallet extension for full manual verification; automated coverage uses the fake EIP-1193 provider.

## Next Action
Manual browser retest per the P1 patch completion report (connect on 968, externally switch to Celo → BOT TESTNET REQUIRED with balances blocked, Switch network back to 968, reject case, disconnect). P2 not started.