# Next.js Project Setup Design

## Scope

Scaffold a new Next.js application directly in the current empty working directory.

## Setup

Run the official generator through npm's `npx` command:

```text
npx create-next-app@latest . --use-npm --yes
```

The generator's recommended defaults provide TypeScript, ESLint, Tailwind CSS, the App Router, Turbopack, the root `app/` directory, the `@/*` import alias, and the current Next.js agent guidance file. The `src/` directory is optional and is not enabled by this command.

## Constraints

- Do not create a nested project directory.
- Use npm through `npx` as requested.
- Do not add application features or third-party services beyond the generator defaults.
- Preserve the generated files and package metadata as produced by the official CLI.

## Verification

After generation, run the generated lint script and production build. Success means both commands exit with status zero and the expected Next.js package files exist.
