import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { navigation } from "@/lib/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useUser, OrganizationSwitcher } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Crown } from "lucide-react";
import { sidebarOrgSwitcherAppearance } from "@/lib/clerk-appearance";
import { useIsFreePlan } from "@/hooks/use-trial";
import { useBillingStatus } from "@/hooks/use-billing";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useUser();
  const isFreePlan = useIsFreePlan();
  const { data: billing } = useBillingStatus();
  const isMaster = billing?.is_master ?? false;

  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-primary">
            xtim
          </span>
          {!collapsed && (
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              .ai
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {navigation.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.filter((item) => !item.masterOnly || isMaster).map((item) => {
                  const active = location.pathname === item.path;
                  const isComingSoon = item.status === "coming-soon";
                  const isLocked = isFreePlan && item.proOnly;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.path}
                          end
                          className={cn(
                            "relative hover:bg-sidebar-accent",
                            active &&
                              "bg-sidebar-accent text-primary font-medium",
                            isComingSoon && "opacity-50",
                            isLocked && "opacity-60"
                          )}
                          activeClassName="bg-sidebar-accent text-primary font-medium"
                        >
                          {active && !isComingSoon && (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                          )}
                          <item.icon className="h-4 w-4" />
                          {!collapsed && (
                            <span className="flex items-center gap-1.5">
                              {item.title}
                              {isComingSoon && (
                                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                              )}
                              {isLocked && (
                                <Crown className="h-2.5 w-2.5 text-primary/60" />
                              )}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-2">
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl="/painel"
              afterSelectOrganizationUrl="/painel"
              appearance={sidebarOrgSwitcherAppearance}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.fullName || "Utilizador"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
