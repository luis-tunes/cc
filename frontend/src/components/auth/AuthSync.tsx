import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setTokenProvider } from "@/lib/api";

/**
 * Bridges the Clerk React SDK (useAuth) to the plain api.ts client.
 * Renders nothing — just registers the token provider on mount.
 */
export function AuthSync() {
  const { getToken } = useAuth();

  useEffect(() => {
    setTokenProvider(async () => {
      try {
        return await getToken();
      } catch {
        // crypto.subtle unavailable over HTTP — proceed without token
        return null;
      }
    });
  }, [getToken]);

  return null;
}
