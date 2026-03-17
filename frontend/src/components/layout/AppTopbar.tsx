import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Building2, CalendarDays } from "lucide-react";
import { useCommandMenu } from "@/components/shared/CommandMenu";
import { QuickAddButton } from "@/components/global/QuickAddButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useClerk } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppTopbarProps {
  title?: string;
}

export function AppTopbar({ title }: AppTopbarProps) {
  const { open: openCommand } = useCommandMenu();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <TrialBanner />
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          {!isMobile && <SidebarTrigger className="text-muted-foreground" />}
          {title && (
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          )}
        </div>

        {/* Center */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="font-medium text-foreground">
              {user?.organizationMemberships?.[0]?.organization?.name || "TIM"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            <span>{new Date().getFullYear()}</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground md:h-8 md:w-8"
            onClick={openCommand}
            aria-label="Pesquisar"
          >
            <Search className="h-4 w-4" />
          </Button>

          {/* Theme */}
          <ThemeToggle />

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-border" />

          {/* Global CTA */}
          <QuickAddButton />

          <button
            onClick={() => navigate("/perfil")}
            className="shrink-0 rounded-full ring-2 ring-transparent transition-all hover:ring-primary/40"
            title="O meu perfil"
            aria-label="O meu perfil"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
            onClick={() => signOut()}
            title="Terminar sessão"
            aria-label="Terminar sessão"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </Button>
        </div>
      </header>
    </>
  );
}
