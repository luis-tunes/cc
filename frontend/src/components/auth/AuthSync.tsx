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
    setTokenProvider(() => getToken());
  }, [getToken]);

  return null;
}
