import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppTopbar } from "./AppTopbar";
import { CommandMenu } from "@/components/shared/CommandMenu";
import { navigation } from "@/lib/navigation";

function getPageTitle(pathname: string): string {
  for (const group of navigation) {
    for (const item of group.items) {
      if (item.path === pathname) return item.title;
    }
  }
  return "";
}

export function AppLayout() {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <AppTopbar title={pageTitle} />
          <Outlet />
        </div>
      </div>
      <CommandMenu />
    </SidebarProvider>
  );
}
