import { SignIn } from "@clerk/react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">TIM</h1>
          <p className="mt-1 text-sm text-muted-foreground">Time is Money</p>
        </div>
        <SignIn
          routing="path"
          path="/auth/sign-in"
          signUpUrl="/auth/sign-up"
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "bg-card border-border shadow-lg",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formFieldLabel: "text-foreground",
              formFieldInput: "bg-muted border-border text-foreground",
              footerActionLink: "text-primary hover:text-primary/80",
              formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
            },
          }}
        />
      </div>
    </div>
  );
}
