import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { AuthSync } from "@/components/auth/AuthSync";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./index.css";

const queryClient = new QueryClient({
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
      <ClerkProvider publishableKey={CLERK_KEY}>
        <AuthSync />
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
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
