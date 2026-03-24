import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Building2, CalendarDays, LogOut, ArrowLeft } from "lucide-react";
import { useCommandMenu } from "@/components/shared/CommandMenu";
import { QuickAddButton } from "@/components/global/QuickAddButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useClerk } from "@clerk/react";
import { useNavigate, useLocation } from "react-router-dom";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { useIsMobile } from "@/hooks/use-mobile";

const MOBILE_TAB_PATHS = ["/painel", "/documentos", "/movimentos", "/reconciliacao"];

interface AppTopbarProps {
  title?: string;
}

export function AppTopbar({ title }: AppTopbarProps) {
  const { open: openCommand } = useCommandMenu();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const showBackButton = isMobile && !MOBILE_TAB_PATHS.includes(location.pathname);

  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <TrialBanner />
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 sticky top-0 z-40">
        {/* Left */}
        <div className="flex items-center gap-3">
          {!isMobile && <SidebarTrigger className="text-muted-foreground" />}
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => {
                if (window.history.length > 1) {
                  navigate(-1);
                } else {
                  navigate("/painel", { replace: true });
                }
              }}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {title && (
            <span className="text-lg font-semibold text-foreground">{title}</span>
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
          <div className="hidden md:block">
            <ThemeToggle />
          </div>

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
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
    </>
  );
}
