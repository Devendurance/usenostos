# Next.js Project Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a new Next.js application directly in the current working directory with the official `create-next-app` CLI.

**Architecture:** Use the official generator without custom application code. The generated App Router project will use the standard root `app/` layout and generator-managed configuration; no extra services or dependencies will be added.

**Tech Stack:** Next.js latest, TypeScript, ESLint, Tailwind CSS, App Router, Turbopack, npm via `npx`.

## Global Constraints

- Do not create a nested project directory.
- Use npm through `npx` as requested.
- Do not add application features or third-party services beyond the generator defaults.
- Preserve the generated files and package metadata as produced by the official CLI.

---

### Task 1: Scaffold And Verify The Next.js Application

**Files:**
- Existing: `docs/superpowers/specs/2026-08-15-nextjs-project-setup-design.md`
- Create: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `app/`, `public/`, and the remaining files produced by `create-next-app`
- Verify: generated npm scripts and Next.js project build

**Interfaces:**
- Consumes: the empty current directory and the approved setup specification.
- Produces: a runnable Next.js App Router application with npm scripts for development, linting, and production builds.

- [ ] **Step 1: Run the official generator in the current directory**

Run from `C:\Users\USER\Documents\ideas\botchain-rwa-product`:

```text
npx create-next-app@latest . --use-npm --yes
```

Expected: the CLI creates the application in `.` without asking interactive questions, installs dependencies with npm, and completes successfully.

- [ ] **Step 2: Confirm the generated project metadata**

Read `package.json` and confirm it contains the generated Next.js scripts, including:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  }
}
```

Confirm the project contains `app/layout.tsx`, `app/page.tsx`, and `app/globals.css`.

- [ ] **Step 3: Run the generated lint check**

Run:

```text
npm run lint
```

Expected: exit status zero with no lint errors.

- [ ] **Step 4: Run the production build**

Run:

```text
npm run build
```

Expected: exit status zero and a successful Next.js production build.

- [ ] **Step 5: Report the result without adding unrelated changes**

Summarize the generated project location, the generator command, and the results of `npm run lint` and `npm run build`. Do not add application features or modify generated configuration unless a verification failure requires it.
