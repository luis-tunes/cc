import { useAuth } from "@clerk/react";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

const AUTH_BYPASS =
  import.meta.env.VITE_AUTH_DISABLED === "1" || !!import.meta.env.VITE_E2E_TEST;

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isSignedIn, isLoaded } = useAuth();

  if (AUTH_BYPASS) return <>{children}</>;

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">A carregar…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/auth/sign-in" replace />;
  }

  return <>{children}</>;
}
