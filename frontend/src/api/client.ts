import type {
  ApiErrorBody,
  AuthResponse,
  DatasetMutationResponse,
  PortfolioResponse,
  TransactionFilters,
  TransactionsResponse,
} from "./types";

const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(input: {
    readonly status: number;
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  }) {
    super(input.message);
    this.name = "ApiError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

async function parseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return response.json() as Promise<unknown>;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers,
  };
  const response = await fetch(`${API_PREFIX}${path}`, requestInit);

  if (response.status === 204) {
    return undefined as T;
  }

  const parsed = await parseJson(response);

  if (!response.ok) {
    if (isApiErrorBody(parsed)) {
      throw new ApiError({
        status: response.status,
        code: parsed.code,
        message: parsed.message,
        details: parsed,
      });
    }

    throw new ApiError({
      status: response.status,
      code: response.status === 413 ? "UPLOAD_TOO_LARGE" : "REQUEST_FAILED",
      message:
        response.status === 413
          ? "The selected file is too large."
          : "The request failed.",
      details: parsed,
    });
  }

  return parsed as T;
}

function searchParamsFromFilters(filters: TransactionFilters): string {
  const params = new URLSearchParams();
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (filters.symbol !== undefined && filters.symbol.length > 0) {
    params.set("symbol", filters.symbol);
  }

  if (filters.exchange !== undefined) {
    params.set("exchange", filters.exchange);
  }

  if (filters.side !== undefined) {
    params.set("side", filters.side);
  }

  if (filters.from !== undefined && filters.from.length > 0) {
    params.set("from", filters.from);
  }

  if (filters.to !== undefined && filters.to.length > 0) {
    params.set("to", filters.to);
  }

  return params.toString();
}

export const api = {
  login(input: {
    readonly email: string;
    readonly password: string;
  }): Promise<AuthResponse> {
    return requestJson<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<undefined> {
    return requestJson<undefined>("/auth/logout", { method: "POST" });
  },

  me(): Promise<AuthResponse> {
    return requestJson<AuthResponse>("/auth/me");
  },

  portfolio(): Promise<PortfolioResponse> {
    return requestJson<PortfolioResponse>("/portfolio");
  },

  transactions(filters: TransactionFilters): Promise<TransactionsResponse> {
    return requestJson<TransactionsResponse>(
      `/transactions?${searchParamsFromFilters(filters)}`,
    );
  },

  importTrades(file: File): Promise<DatasetMutationResponse> {
    const formData = new FormData();
    formData.set("file", file);

    return requestJson<DatasetMutationResponse>("/imports/trades", {
      method: "POST",
      body: formData,
    });
  },

  resetSampleData(): Promise<DatasetMutationResponse> {
    return requestJson<DatasetMutationResponse>("/datasets/reset-sample", {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
  },

  clearTransactions(): Promise<DatasetMutationResponse> {
    return requestJson<DatasetMutationResponse>("/datasets/clear-transactions", {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
  },
};
