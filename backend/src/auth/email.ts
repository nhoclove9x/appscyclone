export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
