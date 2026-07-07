import { useCallback, useEffect, useState } from "react";
import {
  authStore,
  ensureCloudAuthSession,
  initAuthStore,
  signInToCloud,
  signOutFromCloud,
  trySilentCloudSignIn,
  type AuthStatus,
} from "@/utils/auth/auth-store";
import type { AuthSession } from "@/utils/auth/types";

export function useCloudAuth() {
  const [status, setStatus] = useState<AuthStatus>("unknown");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void initAuthStore().then(() => {
      const state = authStore.getState();
      setStatus(state.status);
      setSession(state.session);
      setErrorMessage(state.errorMessage);
      setReady(true);
    });

    return authStore.subscribe(() => {
      const state = authStore.getState();
      setStatus(state.status);
      setSession(state.session);
      setErrorMessage(state.errorMessage);
    });
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void trySilentCloudSignIn();
  }, [ready]);

  const signIn = useCallback(async () => {
    return signInToCloud();
  }, []);

  const signOut = useCallback(async () => {
    await signOutFromCloud();
  }, []);

  const ensureSession = useCallback(async () => {
    return ensureCloudAuthSession();
  }, []);

  return {
    status,
    session,
    errorMessage,
    ready,
    isSignedIn: status === "signed_in" && session !== null,
    signIn,
    signOut,
    ensureSession,
  };
}
