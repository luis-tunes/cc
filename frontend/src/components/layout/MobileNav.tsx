import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FileText, GitMerge, Landmark, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { navigation } from "@/lib/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const MOBILE_TABS = [
  { title: "Painel", path: "/painel", icon: LayoutDashboard },
  { title: "Documentos", path: "/documentos", icon: FileText },
  { title: "Movimentos", path: "/movimentos", icon: Landmark },
  { title: "Reconciliação", path: "/reconciliacao", icon: GitMerge },
];

export function MobileNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  // All nav items not in the bottom bar
  const moreItems = navigation.flatMap((g) => g.items).filter(
    (item) => !MOBILE_TABS.some((t) => t.path === item.path)
  );

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-end justify-around border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {MOBILE_TABS.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className="text-[11px] leading-tight">{tab.title}</span>
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-b bg-primary" />}
            </NavLink>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
            moreOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[11px] leading-tight">Mais</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle className="text-base">Navegação</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {moreItems.map((item) => {
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
        </SheetContent>
      </Sheet>
    </>
  );
}
