import { browser } from "wxt/browser";
import { GOOGLE_OAUTH_CLIENT_ID } from "./constants";
import { AuthError } from "./types";

function parseIdTokenFromResponseUrl(responseUrl: string): string | null {
  const url = new URL(responseUrl);
  const hashParams = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const queryParams = url.searchParams;
  return hashParams.get("id_token") ?? queryParams.get("id_token");
}

function buildGoogleAuthUrl(interactive: boolean): string {
  if (!GOOGLE_OAUTH_CLIENT_ID) {
    throw new AuthError(
      "not_configured",
      "Google OAuth client ID is not configured. Set WXT_GOOGLE_OAUTH_CLIENT_ID in .env.",
    );
  }

  const redirectUri = `https://${browser.runtime.id}.chromiumapp.org/`;
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce: crypto.randomUUID(),
  });

  if (interactive) {
    params.set("prompt", "select_account");
  } else {
    params.set("prompt", "none");
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function launchGoogleSignIn(
  interactive: boolean,
): Promise<string | null> {
  const url = buildGoogleAuthUrl(interactive);

  try {
    const responseUrl = await browser.identity.launchWebAuthFlow({
      url,
      interactive,
    });

    if (!responseUrl) {
      return null;
    }

    return parseIdTokenFromResponseUrl(responseUrl);
  } catch (error) {
    if (!interactive) {
      return null;
    }

    const message =
      error instanceof Error ? error.message : "Google sign-in was cancelled.";

    if (/canceled|cancelled/i.test(message)) {
      throw new AuthError("cancelled", "Sign-in was cancelled.");
    }

    throw new AuthError("unknown", message);
  }
}

export async function trySilentGoogleSignIn(): Promise<string | null> {
  return launchGoogleSignIn(false);
}

export async function signInWithGoogleExplicit(): Promise<string> {
  const idToken = await launchGoogleSignIn(true);

  if (!idToken) {
    throw new AuthError("cancelled", "Sign-in did not return a token.");
  }

  return idToken;
}
