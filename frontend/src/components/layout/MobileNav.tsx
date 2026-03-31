import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Inbox, GitMerge, MoreHorizontal, User, X } from "lucide-react";
import { useState } from "react";
import { navigation } from "@/lib/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const MOBILE_TABS = [
  { title: "Painel", path: "/painel", icon: LayoutDashboard },
  { title: "Entrada", path: "/caixa-entrada", icon: Inbox },
  { title: "Reconciliação", path: "/reconciliacao", icon: GitMerge },
];

const MOBILE_TAB_PATHS = new Set(MOBILE_TABS.map((t) => t.path));

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // Build grouped "more" items — skip items already in bottom bar
  const moreGroups = navigation
    .map((group) => ({
      label: group.label,
      items: group.items.filter((item) => !MOBILE_TAB_PATHS.has(item.path)),
    }))
    .filter((g) => g.items.length > 0);

  // Flat list for "is on more page" check
  const allMorePaths = moreGroups.flatMap((g) => g.items.map((i) => i.path));
  const isOnMorePage = allMorePaths.includes(location.pathname) || location.pathname === "/perfil";

  return (
    <>
      <nav
        aria-label="Navegação principal"
        aria-hidden={moreOpen}
        className={cn(
          "fixed inset-x-0 bottom-0 z-[60] flex items-center justify-around border-t tim-mobile-glass md:hidden transition-opacity duration-200",
          moreOpen && "opacity-40 pointer-events-none"
        )}
        style={{ height: "calc(4rem + env(safe-area-inset-bottom, 0px))", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {MOBILE_TABS.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className="text-xs leading-tight">{tab.title}</span>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b bg-primary" />}
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
            moreOpen || isOnMorePage ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-xs leading-tight">Mais</span>
          {isOnMorePage && !moreOpen && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b bg-primary" />}
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[75vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-base">Navegação</SheetTitle>
          </SheetHeader>
          <button
            onClick={() => setMoreOpen(false)}
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
          <ScrollArea className="mt-3 max-h-[60vh]">
            <div className="space-y-4 pb-4">
              {moreGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.items.map((item) => {
                      const active = location.pathname === item.path;
                      return (
                        <NavLink
                          key={item.path}
                          to={item.path}
                          className={cn(
                            "flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-colors",
                            active ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                          onClick={() => setMoreOpen(false)}
                        >
                          <item.icon className="h-5 w-5" />
                          <span className="text-xs font-medium leading-tight">{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Perfil — always at the bottom */}
              <div>
                <div className="my-2 h-px bg-border" />
                <NavLink
                  to="/perfil"
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3 transition-colors",
                    location.pathname === "/perfil"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                  onClick={() => setMoreOpen(false)}
                >
                  <User className="h-5 w-5" />
                  <span className="text-sm font-medium">Perfil</span>
                </NavLink>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
