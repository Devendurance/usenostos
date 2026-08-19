// Server-only HTTP client. Never import from components/ or client hooks.

import { isCmcErrorCode, extractStatus } from "../normalize";
import type { ProviderHealthStatus } from "../types";

export const COINMARKETCAP_API_KEY_ENV = "COINMARKETCAP_API_KEY";
export const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";
export const CMC_API_KEY_HEADER = "X-CMC_PRO_API_KEY";
export const CMC_TIMEOUT_MS = 10_000;
export const CMC_MAX_EXTRA_RETRIES = 2;
export const CMC_BACKOFF_CAP_MS = 1_000;

export function getCoinMarketCapApiKey(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env[COINMARKETCAP_API_KEY_ENV];
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type CmcClientErrorCode =
  | ProviderHealthStatus
  | "ERROR"
  | "PLAN_RESTRICTED";

export class CmcClientError extends Error {
  readonly code: CmcClientErrorCode;
  readonly httpStatus?: number;
  readonly errorCode?: string | number | null;

  constructor(
    message: string,
    code: CmcClientErrorCode,
    extras?: { httpStatus?: number; errorCode?: string | number | null },
  ) {
    super(message);
    this.name = "CmcClientError";
    this.code = code;
    this.httpStatus = extras?.httpStatus;
    this.errorCode = extras?.errorCode;
  }
}

export type CmcGetDeps = {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
};

export type CmcSuccess<T> = {
  data: T;
  status: {
    error_code: string | number | null;
    error_message?: string | null;
    credit_count?: number | null;
  };
};

function classifyHttp(status: number): CmcClientErrorCode {
  if (status === 401 || status === 403) return "AUTH_FAILED";
  if (status === 402) return "PLAN_RESTRICTED";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "ERROR";
  return "ERROR";
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, CMC_BACKOFF_CAP_MS);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetwork(error: unknown): boolean {
  if (error instanceof CmcClientError) {
    return error.httpStatus !== undefined && error.httpStatus >= 500;
  }
  return error instanceof TypeError || error instanceof DOMException;
}

export async function cmcGet<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  deps: CmcGetDeps = {},
): Promise<CmcSuccess<T>> {
  const apiKey = getCoinMarketCapApiKey(deps.env ?? process.env);
  if (!apiKey) {
    throw new CmcClientError("CoinMarketCap API key is not configured", "UNAVAILABLE");
  }

  const fetchImpl = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? defaultSleep;
  const timeoutMs = deps.timeoutMs ?? CMC_TIMEOUT_MS;
  const url = new URL(path.startsWith("http") ? path : `${CMC_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  let lastError: unknown;
  const attempts = 1 + CMC_MAX_EXTRA_RETRIES;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          [CMC_API_KEY_HEADER]: apiKey,
        },
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new CmcClientError("CoinMarketCap authentication failed", "AUTH_FAILED", {
          httpStatus: response.status,
        });
      }
      if (response.status === 402) {
        throw new CmcClientError("CoinMarketCap plan does not include this endpoint", "PLAN_RESTRICTED", {
          httpStatus: response.status,
        });
      }
      if (response.status === 429) {
        throw new CmcClientError("CoinMarketCap rate limited", "RATE_LIMITED", {
          httpStatus: 429,
        });
      }
      if (response.status >= 500) {
        throw new CmcClientError("CoinMarketCap server error", "ERROR", {
          httpStatus: response.status,
        });
      }
      if (!response.ok) {
        throw new CmcClientError("CoinMarketCap request failed", classifyHttp(response.status), {
          httpStatus: response.status,
        });
      }

      const contentType = response.headers.get("content-type") ?? "";
      const raw = await response.text();
      if (contentType && !contentType.toLowerCase().includes("json") && raw.trim() && !raw.trim().startsWith("{")) {
        throw new CmcClientError("CoinMarketCap returned a non-JSON body", "ERROR", {
          httpStatus: response.status,
        });
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new CmcClientError("CoinMarketCap returned malformed JSON", "ERROR", {
          httpStatus: response.status,
        });
      }

      const status = extractStatus(parsed);
      if (!status) {
        throw new CmcClientError("CoinMarketCap response is missing status", "ERROR", {
          httpStatus: response.status,
        });
      }
      if (isCmcErrorCode(status.errorCode)) {
        throw new CmcClientError(
          status.errorMessage || "CoinMarketCap returned an error envelope",
          "ERROR",
          { httpStatus: response.status, errorCode: status.errorCode },
        );
      }

      const envelope = parsed as { data?: T; status?: unknown };
      return {
        data: envelope.data as T,
        status: {
          error_code: status.errorCode,
          error_message: status.errorMessage,
          credit_count: status.creditCount,
        },
      };
    } catch (error) {
      lastError = error;
      const retryable = isRetryableNetwork(error) && attempt < attempts - 1;
      if (!retryable) throw error;
      await sleep(backoffMs(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new CmcClientError("CoinMarketCap request failed", "ERROR");
}
