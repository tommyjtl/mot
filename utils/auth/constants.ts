/** Google OAuth client ID (Chrome extension type). Set in `.env` as WXT_GOOGLE_OAUTH_CLIENT_ID. */
export const GOOGLE_OAUTH_CLIENT_ID =
  import.meta.env.WXT_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

export const AUTH_SESSION_STORAGE_KEY = "motAuthSession";

/** Refresh session when within this window of expiry. */
export const SESSION_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
