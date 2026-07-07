import { createStore } from "@/lib/create-store";
import { resolveRemoteApiBaseUrl } from "../remote-api";
import {
  signInWithGoogleExplicit,
  trySilentGoogleSignIn,
} from "./google-sign-in";
import {
  clearAuthSession,
  exchangeGoogleIdToken,
  getValidAuthSession,
  isSessionValid,
  loadAuthSession,
  saveAuthSession,
} from "./session";
import type { AuthSession, AuthUser } from "./types";
import { AuthError } from "./types";
import { AUTH_SESSION_STORAGE_KEY } from "./constants";

export type AuthStatus =
  | "unknown"
  | "signed_out"
  | "signing_in"
  | "signed_in"
  | "not_allowlisted"
  | "error";

type AuthStoreState = {
  initialized: boolean;
  status: AuthStatus;
  session: AuthSession | null;
  errorMessage: string | null;
};

const initialState: AuthStoreState = {
  initialized: false,
  status: "unknown",
  session: null,
  errorMessage: null,
};

export const authStore = createStore<AuthStoreState>(initialState);

let initPromise: Promise<void> | null = null;

function setSignedIn(session: AuthSession): void {
  authStore.setState({
    status: "signed_in",
    session,
    errorMessage: null,
  });
}

function setSignedOut(): void {
  authStore.setState({
    status: "signed_out",
    session: null,
    errorMessage: null,
  });
}

async function establishSessionFromIdToken(idToken: string): Promise<AuthSession> {
  const baseUrl = await resolveRemoteApiBaseUrl();
  const session = await exchangeGoogleIdToken(idToken, baseUrl);
  await saveAuthSession(session);
  setSignedIn(session);
  return session;
}

export async function initAuthStore(): Promise<void> {
  if (authStore.getState().initialized) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const session = await loadAuthSession();
    if (isSessionValid(session)) {
      authStore.setState({
        initialized: true,
        status: "signed_in",
        session,
        errorMessage: null,
      });
      return;
    }

    if (session) {
      await clearAuthSession();
    }

    authStore.setState({
      initialized: true,
      status: "signed_out",
      session: null,
      errorMessage: null,
    });
  })().finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export function bindAuthSync(): void {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[AUTH_SESSION_STORAGE_KEY]) {
      return;
    }

    const next = changes[AUTH_SESSION_STORAGE_KEY].newValue as
      | AuthSession
      | undefined;

    if (next && isSessionValid(next)) {
      authStore.setState({
        status: "signed_in",
        session: next,
        errorMessage: null,
      });
      return;
    }

    setSignedOut();
  });
}

export function isCloudAuthReady(): boolean {
  const { status, session } = authStore.getState();
  return status === "signed_in" && isSessionValid(session);
}

export function getAuthUser(): AuthUser | null {
  const session = authStore.getState().session;
  return isSessionValid(session) ? session.user : null;
}

export async function trySilentCloudSignIn(): Promise<AuthSession | null> {
  authStore.setState({ status: "signing_in", errorMessage: null });

  try {
    const idToken = await trySilentGoogleSignIn();
    if (!idToken) {
      setSignedOut();
      return null;
    }

    return await establishSessionFromIdToken(idToken);
  } catch (error) {
    if (error instanceof AuthError && error.code === "not_allowlisted") {
      authStore.setState({
        status: "not_allowlisted",
        session: null,
        errorMessage: error.message,
      });
      await clearAuthSession();
      return null;
    }

    setSignedOut();
    return null;
  }
}

export async function signInToCloud(): Promise<AuthSession> {
  authStore.setState({ status: "signing_in", errorMessage: null });

  try {
    const idToken = await signInWithGoogleExplicit();
    return await establishSessionFromIdToken(idToken);
  } catch (error) {
    if (error instanceof AuthError) {
      authStore.setState({
        status: error.code === "not_allowlisted" ? "not_allowlisted" : "error",
        session: null,
        errorMessage: error.message,
      });
      await clearAuthSession();
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Could not sign in to Motif Cloud.";

    authStore.setState({
      status: "error",
      session: null,
      errorMessage: message,
    });
    await clearAuthSession();
    throw new AuthError("unknown", message);
  }
}

export async function signOutFromCloud(): Promise<void> {
  await clearAuthSession();
  setSignedOut();
}

export async function ensureCloudAuthSession(): Promise<AuthSession | null> {
  await initAuthStore();

  const existing = await getValidAuthSession();
  if (existing) {
    setSignedIn(existing);
    return existing;
  }

  return trySilentCloudSignIn();
}
