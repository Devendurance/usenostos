# Nostos - 48-Hour Build Plan

This plan is optimized for execution by multiple autonomous AI coding agents working in parallel. Tasks are designed to be as independent as possible.

**Context:**
- **Product:** Nostos - RWA Yield Gateway & Settlement Protocol on BOT Chain
- **Tech Stack:** Solidity 0.8.x + Foundry (contracts), Next.js 15 + TypeScript + Viem/Wagmi (frontend)
- **Environment:** BOT Chain (EVM-compatible Layer 1)
- **Deadline:** Hackathon submission on Aug 22, 2026. 48-hour build starts Aug 15, 2026 evening.

---

## 1. Tech Stack & Tooling
- **Smart Contracts:** Solidity 0.8.24, Foundry (forge, cast, anvil), OpenZeppelin 5.x
- **Frontend:** Next.js 15 (App Router), TypeScript, Viem 2.x, Wagmi 2.x, React 19
- **Styling:** Vanilla CSS with CSS custom properties (design tokens)
- **Testing:** Foundry tests (Solidity), Vitest (frontend)
- **Deployment:** `forge script` for contracts, Vercel for frontend

## 2. Project Structure
```text
nostos/
├── contracts/                 # Foundry project
│   ├── src/
│   │   ├── NostosGatewayVault.sol
│   │   ├── NostosQueueEngine.sol
│   │   ├── NostosInstantPool.sol
│   │   ├── NostosRegistry.sol
│   │   ├── MockUSDT.sol
│   │   └── interfaces/
│   │       ├── IERC7540.sol
│   │       └── INostosVault.sol
│   ├── test/
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── frontend/                  # Next.js project
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Discovery Explorer
│   │   ├── vault/[address]/
│   │   ├── portfolio/
│   │   ├── redeem/
│   │   └── pool/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   │   ├── contracts.ts       # ABI + addresses
│   │   ├── config.ts          # Chain config
│   │   └── utils.ts
│   └── public/
├── keeper/                    # Keeper bot (Node.js)
│   └── index.ts
└── docs/
```

## 3. Phase Breakdown (48 Hours)

### Phase 1: Foundation (Hours 0-8)
*Parallel execution phase.*

#### Agent A: Smart Contract Foundation
- [ ] Initialize Foundry project (`forge init contracts --no-commit`).
- [ ] Write `IERC7540.sol` interface following the asynchronous redemption vault specification.
- [ ] Write `MockUSDT.sol` (ERC-20 with public mint function for testing).
- [ ] Write `NostosGatewayVault.sol` core structure (ERC-4626 base + `requestRedeem` + `claimRedeem`).
- [ ] Write basic Foundry tests (`test/NostosGatewayVault.t.sol`) for standard deposit/redeem flow.

#### Agent B: Frontend Foundation
- [ ] Initialize Next.js 15 project (`npx create-next-app@latest frontend --typescript --tailwind=false --eslint --app --src-dir=false`).
- [ ] Set up design system (CSS custom properties in `globals.css`, typography, color palette matching "Nostos" branding).
- [ ] Create core app layout with header and navigation links.
- [ ] Set up Wagmi/Viem config (`lib/config.ts`) targeting BOT Chain (and local Anvil node).
- [ ] Build a generic WalletConnect component.
- [ ] Create basic page routing structure (empty pages for `/`, `/vault/[address]`, `/portfolio`, `/redeem`, `/pool`).

### Phase 2: Core Logic (Hours 8-20)

#### Agent A: Smart Contract Core
- [ ] Write `NostosQueueEngine.sol` (FIFO queue mapping, ticket creation, state transfer).
- [ ] Write `NostosInstantPool.sol` (LP deposit logic, instant cashout math with spread fee, claim settled logic).
- [ ] Write `NostosRegistry.sol` (vault registration and APY/yield data tracking).
- [ ] Write epoch finalization logic in the Vault contract (processing queue batches).
- [ ] Write comprehensive unit tests for all new contracts.
- [ ] Write `Deploy.s.sol` deployment script targeting BOT Chain testnet/mainnet.

#### Agent B: Frontend Core Pages
- [ ] Build Discovery Explorer page (`app/page.tsx`): Vault cards, APY filters, sorting mechanisms.
- [ ] Build Vault Detail page (`app/vault/[address]/page.tsx`): Deposit modal, vault stats chart placeholders.
- [ ] Build Portfolio page (`app/portfolio/page.tsx`): Positions list, current yield display.
- [ ] Build contract interaction hooks in `hooks/`: `useDeposit`, `useRequestRedeem`, `useClaimRedeem` (use mock ABIs temporarily if needed).

#### Agent C: Frontend Queue & Pool
- [ ] Build Redemption Queue Tracker component (live countdown, queue position visualizer).
- [ ] Build Instant Cashout modal (quote display showing slippage/fee, confirm, execute logic).
- [ ] Build LP Dashboard page (`app/pool/page.tsx`): LP deposit/withdraw, pool stats, estimated APR.
- [ ] Build a generic transaction notification system (toast alerts for tx sent, confirmed, failed).

### Phase 3: Integration & Polish (Hours 20-36)

#### Agent A: Contract Deployment
- [ ] Deploy all contracts to BOT Chain testnet.
- [ ] Run full E2E flow tests on testnet (deposit -> request -> finalize -> claim).
- [ ] Fix any identified issues or gas optimization bugs.
- [ ] Deploy to BOT Chain Mainnet.
- [ ] Verify smart contracts on the BOT Chain block explorer.

#### Agent B: Frontend Integration
- [ ] Export final ABIs and update `lib/contracts.ts` with deployed BOT Chain Mainnet addresses.
- [ ] Connect all frontend pages/hooks to deployed mainnet contracts.
- [ ] Implement real-time Wagmi event listeners for queue updates (`WatchContractEvent`).
- [ ] Polish UI: Add loading skeletons, error states, and finalized toast notifications.
- [ ] Implement responsive design adjustments for mobile devices.
- [ ] Add micro-animations and CSS hover effects for premium feel.

#### Agent C: Keeper Bot
- [ ] Initialize `keeper` Node.js project (`npm init -y`, `npm i viem typescript dotenv tsx`).
- [ ] Build keeper script (`index.ts`) to monitor epoch schedules and call `finalizeEpoch()`.
- [ ] Implement mock NAV/price update feeds for RWA simulations.
- [ ] Set up cron or interval-based execution logic.

### Phase 4: Demo & Submission (Hours 36-48)

#### Agent A: Demo Preparation
- [ ] Seed demo data: Register vaults, set APYs, create sample LP deposits using owner keys.
- [ ] Execute realistic demo transactions on mainnet to populate the history/queue.
- [ ] Capture all transaction hashes for the hackathon submission form.

#### Agent B: Submission Package
- [ ] Write a comprehensive `README.md` (architecture, setup instructions, mainnet addresses).
- [ ] Record a 2-minute demo video showcasing the core flows.
- [ ] Prepare submission form content (team details, project description, tech stack).
- [ ] Deploy frontend to production via Vercel.
- [ ] Conduct final QA testing of all flows on the Vercel production URL.

## 4. Critical Path
**Identify which tasks block others:**
- *Blocker:* Smart contracts must be deployed before the frontend can connect to real state.
- *Blocker:* Queue tracker requires the deployed `QueueEngine` ABI and logic.
- *Blocker:* Instant cashout requires the deployed `InstantPool` ABI and logic.
- *Blocker:* Keeper bot requires a deployed vault and queue to function.

**Mitigation:** 
Frontend development (Phase 1 & 2) will use hardcoded mock data and draft contract ABIs. In Phase 3, frontend agents will swap the mock `contracts.ts` with the real deployment addresses and ABIs generated by Agent A.

## 5. Definition of Done (Hackathon MVP)
- [ ] Smart contracts deployed and verified on BOT Chain Mainnet.
- [ ] User can connect wallet (WalletConnect/Injected) and see the Discovery Explorer.
- [ ] User can deposit MockUSDT into a vault and receive vault shares.
- [ ] User can request redemption and monitor their status on the queue tracker.
- [ ] User can utilize the instant cashout feature to bypass the queue for a fee.
- [ ] LPs can deposit MockUSDT into the instant pool to earn fees.
- [ ] Keeper bot successfully finalizes epochs automatically.
- [ ] At least 3 mainnet transactions completed and documented for the demo.
- [ ] 2-minute demo video recorded and uploaded.
- [ ] `README.md` complete with architecture diagrams, setup instructions, and tx hashes.

## 6. Risk Mitigation
| Risk | Mitigation |
|------|------------|
| BOT Chain RPC issues / rate limits | Have fallback public RPC endpoints configured in `config.ts` |
| Contract deployment fails | Test extensively on local Anvil fork before deploying |
| Frontend build errors (Vercel) | Use simple, proven React patterns; strictly avoid experimental Next.js features; enforce strict TypeScript |
| Time overrun on smart contracts | Simplify: merge `QueueEngine` directly into Vault if time is critical |
| Demo data issues / liquidity dry up | Pre-fund dev wallets with mainnet gas tokens and MockUSDT early |

## 7. Agent Assignment Guide
When an AI agent picks up a task, they must refer to this standard protocol:

- **Target Files:** Always check the project structure (Section 2) to ensure files are placed in the correct directories (e.g., `contracts/src`, `frontend/app`).
- **Dependencies:** 
  - For Solidity: Add via `forge install` and map in `foundry.toml`.
  - For Next.js: Use `npm install` within the `frontend` directory.
- **Expected Output:** Ensure the feature matches the Definition of Done. UI components must match the Nostos brand style (CSS variables). Contracts must pass internal tests before marking complete.
- **Verification:** 
  - Contracts: Run `forge test` and ensure 100% pass rate.
  - Frontend: Run `npm run lint` and `npm run build` locally to ensure no compile errors before moving to the next task.
- **Communication:** Agents should leave clear comments in code for integration points (e.g., `// TODO: Replace with real ABI in Phase 3`).
