# Agent State Workflow Design

## Goal

Give every coding session a small, predictable handoff record so a new agent can resume work after context compaction or a session restart.

## State Location

Use the committed project-local `.agent-state/` directory. It contains exactly three durable Markdown snapshots:

- `project-state.md` - the current product and engineering snapshot: what exists, architecture, important commands, completed areas, and known issues.
- `memory.md` - durable decisions, constraints, conventions, and context that should survive beyond the active task.
- `left-off.md` - the current session handoff: active task, recent work, files changed, verification results, blockers, and the next concrete action.

## Agent Workflow

Add a state-management section to `AGENTS.md`:

1. At the start of every session, read all three state files before making assumptions or exploring broadly.
2. Before substantial implementation, update `left-off.md` with the intended task and relevant constraints.
3. After meaningful work or verification, update the appropriate state file instead of relying on chat history.
4. Before context compaction, session handoff, or stopping, refresh all three files when their information has changed, with `left-off.md` containing the exact next step.
5. Record confirmed facts only; mark unresolved items as known issues or blockers rather than inventing details.

The workflow is instruction-driven. Project Markdown cannot detect an agent's compaction event or update files without an agent action, so the instructions establish a repeatable convention rather than a system-level hook.

## Initial State

Seed the files from the repository as it exists when this setup is implemented. Include the current Next.js scaffold, product documentation, design-system reference, available npm commands, and any known gaps such as the absence of a test script. Do not overwrite unrelated user changes.

## Version Control

Commit `.agent-state/` so the state is available to future agents and collaborators. Do not add it to `.gitignore`.

## Verification

Confirm the three files exist, contain the required sections, and are referenced by `AGENTS.md`. Run the available project checks after the documentation changes: `npm run lint` and `npm run build`. No test framework will be added as part of this setup.
