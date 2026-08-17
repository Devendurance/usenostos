import { existsSync } from "node:fs";

// Server/script-only environment loading for CLI tools. Loads the repo's
// local non-public env files into process.env BEFORE a script reads any
// secret or configuration. Load order: `.env` first, then `.env.local` so
// local overrides win. Never import this from `app/` or `components/`.
export function loadEnvFileIntoProcess(file: string): void {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      // Ignore invalid env files; variables may already be provided.
    }
  }
}

export function loadScriptEnv(): void {
  loadEnvFileIntoProcess(".env");
  loadEnvFileIntoProcess(".env.local");
}