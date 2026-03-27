import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster, toast } from "sonner";
import App from "./App";
import { AuthSync } from "@/components/auth/AuthSync";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import { ApiError } from "@/lib/api";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./index.css";

const mutationCache = new MutationCache({
  onError(error) {
    if (error instanceof ApiError) {
      if (error.isNetworkError) return; // OfflineBanner handles this
      if (error.isRateLimited) {
        toast.error("Demasiados pedidos. Aguarde um momento.");
        return;
      }
      toast.error(error.detail || "Ocorreu um erro inesperado.");
    }
  },
});

const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ClerkProvider publishableKey={CLERK_KEY} appearance={clerkAppearance} afterSignOutUrl="/">
        <AuthSync />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <OfflineBanner />
            <App />
            <Toaster
              position="bottom-right"
              theme="system"
              toastOptions={{
                className: "bg-card text-card-foreground border-border",
              }}
            />
          </BrowserRouter>
        </QueryClientProvider>
      </ClerkProvider>
    </ThemeProvider>
  </React.StrictMode>
);

// Register service worker for PWA support
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
