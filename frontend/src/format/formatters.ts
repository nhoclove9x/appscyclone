export function formatUtcDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function formatCurrency(value: string, options: {
  readonly signDisplay?: "auto" | "always" | "exceptZero" | "never";
} = {}): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    signDisplay: options.signDisplay ?? "auto",
    style: "currency",
  }).format(Number(value));
}

export function formatDecimal(value: string, maximumFractionDigits = 8): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(Number(value));
}

export function formatPercent(value: string): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "percent",
  }).format(Number(value));
}

export function chartNumber(value: string): number {
  return Number(value);
}

export function signedTone(value: string): "positive" | "negative" | "neutral" {
  if (value.startsWith("-")) {
    return "negative";
  }

  if (Number(value) > 0) {
    return "positive";
  }

  return "neutral";
}
