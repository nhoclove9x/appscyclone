export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "ACCOUNT_DISABLED"
  | "INVALID_ORIGIN"
  | "INVALID_REQUEST"
  | "USER_ALREADY_EXISTS";

export interface ApiErrorBody {
  readonly code: AuthErrorCode;
  readonly message: string;
}

export function authErrorBody(
  code: AuthErrorCode,
  message: string,
): ApiErrorBody {
  return { code, message };
}
