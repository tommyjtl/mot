import { getAuthorizationHeader, getValidAuthSession } from "./auth/session";
import { getRemoteApiBaseUrl, initRuntimeModeStore } from "./runtime-mode-store";

export type RemoteHealthResponse = {
  status: string;
  services?: {
    translation?: string;
    tts?: string;
    stt?: string;
  };
  auth?: {
    required?: boolean;
    signed_in?: boolean;
  };
  user?: {
    sub: string;
    email: string;
  };
};

export class AuthRequiredError extends Error {
  constructor(message = "Motif Cloud sign-in required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function resolveRemoteApiBaseUrl(): Promise<string> {
  await initRuntimeModeStore();
  return getRemoteApiBaseUrl();
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getValidAuthSession();
  if (!session) {
    throw new AuthRequiredError();
  }

  return getAuthorizationHeader(session);
}

export async function fetchRemote(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const origin = await resolveRemoteApiBaseUrl();
  const headers = await authHeaders();

  return fetch(`${origin}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers,
      ...headers,
    },
  });
}

export async function fetchRemoteHealth(
  baseUrl?: string,
  options?: { authenticated?: boolean },
): Promise<RemoteHealthResponse | null> {
  const origin = baseUrl ?? (await resolveRemoteApiBaseUrl());
  const headers: Record<string, string> = { Accept: "application/json" };

  if (options?.authenticated) {
    try {
      Object.assign(headers, await authHeaders());
    } catch {
      return null;
    }
  }

  try {
    const response = await fetch(`${origin}/v1/health`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as RemoteHealthResponse;
  } catch {
    return null;
  }
}
