export type AuthUser = {
  sub: string;
  email: string;
};

export type AuthSession = {
  accessToken: string;
  /** Unix timestamp in milliseconds. */
  expiresAt: number;
  user: AuthUser;
};

export type AuthErrorCode =
  | "not_configured"
  | "cancelled"
  | "not_allowlisted"
  | "invalid_token"
  | "auth_required"
  | "network"
  | "unknown";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly email?: string;

  constructor(code: AuthErrorCode, message: string, email?: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.email = email;
  }
}

export type SessionExchangeResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
  user: AuthUser;
};
