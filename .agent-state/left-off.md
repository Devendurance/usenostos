# Left Off

## Current Task
Added P6 first-depositor donation/inflation Foundry regression. Virtual offset unchanged. No deploy.

## Change
- `contracts/test/NostosInstantPoolP6.t.sol` only: two new tests.
- `NostosInstantPoolP6.sol` not modified.

## Verification
`forge test --root contracts --match-path test/NostosInstantPoolP6.t.sol -vv`: 46 passed, 0 failed.
`forge fmt --check` on the test file: clean.

## Next Action
Uncommitted P6 work remains. Do not deploy unless authorized.
