import { SignUp } from "@clerk/react";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
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
          appearance={clerkAppearance}
        />
        <p className="text-xs text-muted-foreground/60 text-center">
          Dados encriptados · Sem compromisso · Suporte em português
        </p>
      </div>
    </div>
  );
}
