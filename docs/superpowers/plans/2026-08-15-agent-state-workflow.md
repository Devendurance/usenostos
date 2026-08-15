# Agent State Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a committed `.agent-state/` handoff system and agent instructions that preserve project context across long coding sessions.

**Architecture:** Use three project-local Markdown snapshots with separate responsibilities: durable project state, durable memory, and the active session handoff. Add a concise lifecycle contract to `AGENTS.md`; no runtime code, hooks, dependencies, or test framework are needed.

**Tech Stack:** Markdown, Git, existing Next.js 16.3.1 project tooling.

## Global Constraints

- Use the committed project-local `.agent-state/` directory.
- Keep exactly three state files: `project-state.md`, `memory.md`, and `left-off.md`.
- Read all three state files at the start of every session.
- Refresh `left-off.md` before session handoff, compaction, or stopping.
- Record confirmed facts only; mark uncertainty as a known issue or blocker.
- Do not overwrite unrelated user changes in `AGENTS.md` or existing product documentation.
- Do not add a runtime hook, dependency, or test framework.
- Commit only the new `.agent-state/` files; leave pre-existing worktree changes unstaged.

---

### Task 1: Create The Initial State Snapshots

**Files:**
- Create: `.agent-state/project-state.md`
- Create: `.agent-state/memory.md`
- Create: `.agent-state/left-off.md`

**Interfaces:**
- Consumes: the current repository structure, `package.json`, `DESIGN.md`, and the Nostos product documentation in `docs/`.
- Produces: three concise Markdown files that a new agent can read without relying on chat history.

- [ ] **Step 1: Create `.agent-state/project-state.md`**

Include these sections and confirmed values:

```markdown
# Project State

## Snapshot
- Product: Nostos, an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- Current status: Next.js foundation scaffolded; product implementation has not replaced the starter page.
- Frontend location: `app/`.

## Architecture
- Frontend: Next.js 16.3.1 App Router with TypeScript, React 19, Tailwind CSS 4, and ESLint.
- Current route: the generated `/` page in `app/page.tsx`.
- Root layout and metadata: `app/layout.tsx`.
- Design reference: `DESIGN.md`.
- Product planning: `docs/nostos-*.md`.

## Completed
- Created the Next.js application with `npx create-next-app@latest . --use-npm --yes`.
- Installed dependencies and generated the App Router structure.
- Confirmed `npm run lint` and `npm run build` succeed.
- Added product, architecture, data-schema, build-plan, research, and brand documentation.

## Commands
- `npm run dev` - start the development server.
- `npm run lint` - run ESLint.
- `npm run build` - create a production build.
- `npm run start` - serve a production build.

## Known Issues And Gaps
- No `npm test` script or test framework is configured.
- The home page and metadata are still the create-next-app starter content.
- Contract, keeper, wallet, and product UI implementation described in the planning docs is not yet present.
- `docs/nostos-build-plan.md` describes a Next.js 15 target while the installed project uses Next.js 16.3.1.
```

- [ ] **Step 2: Create `.agent-state/memory.md`**

Record durable context without duplicating the active handoff:

```markdown
# Project Memory

## Product
- Nostos is an RWA Yield Gateway and Settlement Protocol on BOT Chain.
- The planned product spans a Next.js frontend, Solidity contracts, and a Node.js keeper.

## Engineering Decisions
- The frontend uses the Next.js App Router and root `app/` directory.
- The repository state folder is `.agent-state/` and is committed to Git.
- State files are factual Markdown snapshots, not a chat transcript.

## Design Constraints
- `DESIGN.md` is the governing UI reference for future frontend work.
- Read relevant Next.js guidance in `node_modules/next/dist/docs/` before writing Next.js code.
- Do not add secrets or credentials to state files.

## Verification
- Available checks are `npm run lint` and `npm run build`.
- There is currently no `npm test` script.
```

- [ ] **Step 3: Create `.agent-state/left-off.md`**

Make the initial handoff describe the completed state-system setup and its next use:

```markdown
# Left Off

## Current Task
Establish the committed agent state workflow for cross-session handoffs.

## Completed In This Session
- Created the three `.agent-state/` snapshots.
- Added the state lifecycle instructions to `AGENTS.md`.
- Verified the documentation changes with the available project checks.

## Files Involved
- `.agent-state/project-state.md`
- `.agent-state/memory.md`
- `.agent-state/left-off.md`
- `AGENTS.md`

## Verification
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: unavailable because no test script exists.

## Blockers
- None for the state workflow.
- Existing unrelated worktree changes remain unstaged.

## Next Action
At the beginning of the next session, read all three `.agent-state/` files before changing the application, then update `left-off.md` with the next active task.
```

- [ ] **Step 4: Check the new Markdown files for scope**

Run:

```text
ls .agent-state
```

Expected: the directory contains exactly `project-state.md`, `memory.md`, and `left-off.md`. Read all three files and confirm they contain no secrets or generated artifacts; the staged whitespace check is performed in Task 3.

### Task 2: Add The Agent State Lifecycle To AGENTS.md

**Files:**
- Modify: `AGENTS.md` by appending a new section after the existing UI design rules

**Interfaces:**
- Consumes: the three files created in Task 1.
- Produces: a repository-level instruction contract that tells future agents when to read and update state.

- [ ] **Step 1: Append the state workflow without replacing existing instructions**

Append exactly this section:

```markdown
## AGENT STATE

- At the start of every session, read `.agent-state/project-state.md`, `.agent-state/memory.md`, and `.agent-state/left-off.md` before making assumptions or exploring broadly.
- Before substantial work, update `.agent-state/left-off.md` with the current task, scope, and relevant constraints.
- After meaningful implementation or verification, update the relevant state files with confirmed facts.
- Before ending a session or handing work to another agent, refresh `.agent-state/left-off.md` with files changed, verification results, blockers, and one concrete next step.
- Keep state concise and factual. Do not record secrets. Mark uncertainty as a known issue or blocker.
```

- [ ] **Step 2: Verify the existing user-owned AGENTS.md content remains present**

Run:

```text
git diff -- AGENTS.md
```

Expected: the existing worktree replacement of the generated Next.js rules remains intact, with only the new `## AGENT STATE` section appended after it.

### Task 3: Verify And Commit Only The New State Files

**Files:**
- Verify: `.agent-state/project-state.md`, `.agent-state/memory.md`, `.agent-state/left-off.md`, `AGENTS.md`
- Stage and commit: `.agent-state/project-state.md`, `.agent-state/memory.md`, `.agent-state/left-off.md`
- Leave unstaged: `AGENTS.md` and all pre-existing product and planning changes

**Interfaces:**
- Consumes: the completed state files and lifecycle instructions.
- Produces: passing project checks and a Git commit containing only `.agent-state/`.

- [ ] **Step 1: Run the available project checks**

Run:

```text
npm run lint
npm run build
```

Expected: both commands exit with status zero. Do not add a test framework when `npm test` is unavailable.

- [ ] **Step 2: Inspect the exact worktree scope before staging**

Run:

```text
git status --short
git diff --check
git log --oneline -5
```

Confirm the existing `AGENTS.md`, product docs, and superpowers docs are not staged by this task.

- [ ] **Step 3: Stage only the state directory**

Run:

```text
git add -- .agent-state
git diff --cached --stat
```

Expected: the staged diff contains exactly three files under `.agent-state/` and no changes to `AGENTS.md` or `docs/`.

- [ ] **Step 4: Commit the state snapshots**

Run:

```text
git commit -m "docs: add agent state workflow"
```

Expected: one commit is created containing only the three new state files. The `AGENTS.md` instructions remain in the working tree for the user to commit together with their existing changes.

- [ ] **Step 5: Verify the final repository state**

Run:

```text
git status --short
git show --stat --oneline HEAD
```

Expected: the latest commit contains the three `.agent-state/` files, while unrelated existing changes remain unstaged and unmodified.
