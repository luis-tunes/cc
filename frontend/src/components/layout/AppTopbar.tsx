import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Search, Building2, CalendarDays, LogOut, ArrowLeft, Bell } from "lucide-react";
import { useCommandMenu } from "@/components/shared/CommandMenu";
import { QuickAddButton } from "@/components/global/QuickAddButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser, useClerk } from "@clerk/react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { TrialBanner } from "@/components/billing/TrialBanner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { navigation } from "@/lib/navigation";
import { useAlerts } from "@/hooks/use-alerts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const MOBILE_TAB_PATHS = ["/painel", "/caixa-entrada", "/reconciliacao"];

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
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const { data: alerts = [] } = useAlerts();
  const unreadCount = alerts.filter((a) => !a.read).length;

  const showBackButton = isMobile && !MOBILE_TAB_PATHS.includes(location.pathname);

  // Derive breadcrumb from navigation structure
  const breadcrumb = (() => {
    for (const group of navigation) {
      for (const item of group.items) {
        if (item.path === location.pathname) {
          return { group: group.label, page: item.title };
        }
      }
    }
    return null;
  })();

  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <TrialBanner />
      <header className="tim-topbar-wash flex h-14 shrink-0 items-center justify-between bg-card/80 backdrop-blur-xl px-4 sticky top-0 z-40 touch-manipulation">
        {/* Left */}
        <div className="flex items-center gap-3">
          {!isMobile && <SidebarTrigger className="text-muted-foreground" />}
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground"
              onClick={() => navigate(-1)}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          {!isMobile && breadcrumb ? (
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/painel" className="text-xs text-muted-foreground hover:text-foreground">
                      {breadcrumb.group}
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-sm font-semibold">
                    {breadcrumb.page}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          ) : title ? (
            <span className="text-lg font-semibold text-foreground">{title}</span>
          ) : null}
        </div>

        {/* Center */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            <span className="font-medium text-foreground">
              {user?.organizationMemberships?.[0]?.organization?.name || "xtim.ai"}
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

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 text-muted-foreground md:h-8 md:w-8"
                aria-label={`Alertas${unreadCount > 0 ? ` (${unreadCount} não lidos)` : ""}`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-tim-danger px-1 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="border-b px-4 py-3">
                <h4 className="text-sm font-semibold">Alertas</h4>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">{unreadCount} não lido{unreadCount !== 1 ? "s" : ""}</p>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {alerts.filter((a) => !a.read).length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sem alertas pendentes</p>
                ) : (
                  alerts
                    .filter((a) => !a.read)
                    .slice(0, 5)
                    .map((a) => (
                      <button
                        key={a.id}
                        className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50"
                        onClick={() => { if (a.action_url) navigate(a.action_url); }}
                      >
                        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.severity === "critico" ? "bg-tim-danger" : a.severity === "urgente" ? "bg-tim-warning" : "bg-tim-info"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{a.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
                        </div>
                      </button>
                    ))
                )}
              </div>
              {unreadCount > 5 && (
                <div className="border-t px-4 py-2">
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/alertas")}>
                    Ver todos os alertas
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

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
            onClick={() => setShowSignOutConfirm(true)}
            title="Terminar sessão"
            aria-label="Terminar sessão"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <ConfirmDialog
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Terminar sessão"
        description="Tem a certeza que pretende terminar a sessão?"
        confirmLabel="Terminar"
        variant="destructive"
        onConfirm={() => signOut()}
      />
    </>
  );
}
