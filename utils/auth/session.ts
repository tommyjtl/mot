import {
  AUTH_SESSION_STORAGE_KEY,
  SESSION_EXPIRY_BUFFER_MS,
} from "./constants";
import type { AuthSession, SessionExchangeResponse } from "./types";
import { AuthError } from "./types";

function toSession(payload: SessionExchangeResponse): AuthSession {
  return {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000,
    user: payload.user,
  };
}

function parseErrorDetail(
  detail: unknown,
): { code?: string; email?: string } | null {
  if (typeof detail === "string") {
    return { code: detail };
  }

  if (typeof detail === "object" && detail !== null) {
    const record = detail as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      email: typeof record.email === "string" ? record.email : undefined,
    };
  }

  return null;
}

export async function exchangeGoogleIdToken(
  idToken: string,
  baseUrl: string,
): Promise<AuthSession> {
  let response: Response;

  try {
    response = await fetch(`${baseUrl}/v1/auth/session`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id_token: idToken }),
    });
  } catch (error) {
    throw new AuthError(
      "network",
      error instanceof Error
        ? error.message
        : "Could not reach the Motif server.",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | SessionExchangeResponse
    | { detail?: unknown }
    | null;

  if (!response.ok) {
    const parsed = parseErrorDetail(payload?.detail);

    if (response.status === 403 && parsed?.code === "not_allowlisted") {
      throw new AuthError(
        "not_allowlisted",
        parsed.email
          ? `This Google account isn't authorized for Motif Cloud. Signed in as ${parsed.email}.`
          : "This Google account isn't authorized for Motif Cloud.",
        parsed.email,
      );
    }

    if (response.status === 401) {
      throw new AuthError("invalid_token", "Google sign-in token was rejected.");
    }

    throw new AuthError(
      "unknown",
      `Sign-in failed (${response.status}).`,
      parsed?.email,
    );
  }

  if (!payload || !("access_token" in payload) || !payload.user?.sub) {
    throw new AuthError("unknown", "Sign-in returned an invalid response.");
  }

  return toSession(payload);
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  const stored = await browser.storage.local.get(AUTH_SESSION_STORAGE_KEY);
  const session = stored[AUTH_SESSION_STORAGE_KEY];

  if (!session || typeof session !== "object") {
    return null;
  }

  const record = session as Partial<AuthSession>;
  if (
    typeof record.accessToken !== "string" ||
    typeof record.expiresAt !== "number" ||
    !record.user ||
    typeof record.user.sub !== "string" ||
    typeof record.user.email !== "string"
  ) {
    return null;
  }

  return {
    accessToken: record.accessToken,
    expiresAt: record.expiresAt,
    user: {
      sub: record.user.sub,
      email: record.user.email,
    },
  };
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  await browser.storage.local.set({ [AUTH_SESSION_STORAGE_KEY]: session });
}

export async function clearAuthSession(): Promise<void> {
  await browser.storage.local.remove(AUTH_SESSION_STORAGE_KEY);
}

export function isSessionValid(
  session: AuthSession | null,
  now = Date.now(),
): session is AuthSession {
  if (!session) {
    return false;
  }

  return session.expiresAt - SESSION_EXPIRY_BUFFER_MS > now;
}

export async function getValidAuthSession(): Promise<AuthSession | null> {
  const session = await loadAuthSession();
  return isSessionValid(session) ? session : null;
}

export function getAuthorizationHeader(
  session: AuthSession,
): Record<string, string> {
  return { Authorization: `Bearer ${session.accessToken}` };
}
