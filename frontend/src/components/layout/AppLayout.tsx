import { Suspense, useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { MobileNav } from "./MobileNav";
import { CommandMenu } from "@/components/shared/CommandMenu";
import { KeyboardShortcuts } from "@/components/shared/KeyboardShortcuts";
import { navigation } from "@/lib/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

const EXTRA_TITLES: Record<string, string> = {
  "/perfil": "Perfil",
  "/monitoring": "Monitorização",
};

function getPageTitle(pathname: string): string {
  for (const group of navigation) {
    for (const item of group.items) {
      if (item.path === pathname) return item.title;
    }
  }
  return EXTRA_TITLES[pathname] || "";
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageTitle = getPageTitle(location.pathname);
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLDivElement>(null);

  // Move focus to main content area on route change for keyboard/screen reader users
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  // Global "G then ..." navigation shortcuts
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;
    const goMap: Record<string, string> = { h: "/painel", d: "/documentos", r: "/reconciliacao", m: "/movimentos", f: "/fornecedores" };
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.key === "g" && !e.metaKey && !e.ctrlKey) {
        pending = true;
        clearTimeout(timer);
        timer = setTimeout(() => { pending = false; }, 800);
        return;
      }
      if (pending) {
        pending = false;
        clearTimeout(timer);
        const dest = goMap[e.key];
        if (dest) { e.preventDefault(); navigate(dest); }
      }
    };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); clearTimeout(timer); };
  }, [navigate]);

  return (
    <SidebarProvider>
      {/* Skip-to-content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        Ir para conteúdo
      </a>

      <div className="flex min-h-screen w-full">
        {!isMobile && <AppSidebar />}
        <main className="flex flex-1 flex-col">
          <AppTopbar title={pageTitle} />
          <div
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className={`outline-none ${isMobile ? "pb-[calc(4rem+env(safe-area-inset-bottom))]" : ""}`}
            aria-live="polite"
          >
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      {isMobile && <MobileNav />}
      <CommandMenu />
      <KeyboardShortcuts />
    </SidebarProvider>
  );
}
