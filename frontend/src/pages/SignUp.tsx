import { SignUp } from "@clerk/react";
import { Navigate } from "react-router-dom";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  if (import.meta.env.VITE_AUTH_DISABLED === "1") {
    return <Navigate to="/painel" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">TIM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Time is Money</p>
          <p className="mt-3 text-xs text-muted-foreground/80">14 dias grátis · Sem cartão de crédito</p>
        </div>
        <SignUp
          routing="path"
          path="/auth/sign-up"
          signInUrl="/auth/sign-in"
          afterSignUpUrl="/painel"
          appearance={clerkAppearance}
        />
        <p className="text-xs text-muted-foreground/60 text-center">
          Dados encriptados · Sem compromisso · Suporte em português
        </p>
      </div>
    </div>
  );
}
