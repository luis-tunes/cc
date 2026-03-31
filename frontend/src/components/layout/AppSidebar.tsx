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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useUser, OrganizationSwitcher } from "@clerk/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, Crown, ChevronRight } from "lucide-react";
import { sidebarOrgSwitcherAppearance } from "@/lib/clerk-appearance";
import { useIsFreePlan } from "@/hooks/use-trial";
import { useBillingStatus } from "@/hooks/use-billing";
import { useState, useCallback } from "react";

const SIDEBAR_STATE_KEY = "tim-sidebar-groups";

function loadGroupState(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(SIDEBAR_STATE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveGroupState(state: Record<string, boolean>) {
  localStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify(state));
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user } = useUser();
  const isFreePlan = useIsFreePlan();
  const { data: billing } = useBillingStatus();
  const isMaster = billing?.is_master ?? false;

  // Groups that are single-item (Home) start open; others respect saved state
  const [groupState, setGroupState] = useState<Record<string, boolean>>(() => {
    const saved = loadGroupState();
    const defaults: Record<string, boolean> = {};
    for (const group of navigation) {
      // Open by default: Home always, and any group containing the active route
      const hasActive = group.items.some((i) => i.path === location.pathname);
      defaults[group.label] = saved[group.label] ?? (group.items.length <= 1 || hasActive);
    }
    return defaults;
  });

  const toggleGroup = useCallback((label: string) => {
    setGroupState((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      saveGroupState(next);
      return next;
    });
  }, []);

  const initials = (user?.fullName || user?.primaryEmailAddress?.emailAddress || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r-0 tim-sidebar-glow">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="text-sm font-extrabold text-primary">x</span>
          </div>
          {!collapsed && (
            <div className="flex items-baseline gap-0.5">
              <span className="text-xl font-bold tracking-tight text-foreground">
                xtim
              </span>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                .ai
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {navigation.map((group) => {
          const isOpen = groupState[group.label] ?? true;
          const isSingleItem = group.items.length <= 1;
          const hasActiveChild = group.items.some((i) => i.path === location.pathname);

          return (
            <SidebarGroup key={group.label}>
              {isSingleItem || collapsed ? (
                // Single-item groups (Home) don't need a collapsible header
                <>
                  {!collapsed && (
                    <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                      {group.label}
                    </SidebarGroupLabel>
                  )}
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items
                        .filter((item) => !item.masterOnly || isMaster)
                        .map((item) => (
                          <SidebarNavItem
                            key={item.path}
                            item={item}
                            active={location.pathname === item.path}
                            collapsed={collapsed}
                            isFreePlan={isFreePlan}
                          />
                        ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </>
              ) : (
                <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.label)}>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="flex w-full cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                      <span className="flex items-center gap-1.5">
                        {group.label}
                        {!isOpen && hasActiveChild && (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-3 w-3 transition-transform duration-200",
                          isOpen && "rotate-90"
                        )}
                      />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items
                          .filter((item) => !item.masterOnly || isMaster)
                          .map((item) => (
                            <SidebarNavItem
                              key={item.path}
                              item={item}
                              active={location.pathname === item.path}
                              collapsed={collapsed}
                              isFreePlan={isFreePlan}
                            />
                          ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarGroup>
          );
        })}
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

/* ── Extracted nav item (shared between collapsible and flat groups) ── */

import type { NavItem } from "@/lib/navigation";

interface SidebarNavItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  isFreePlan: boolean;
}

function SidebarNavItem({ item, active, collapsed, isFreePlan }: SidebarNavItemProps) {
  const isComingSoon = item.status === "coming-soon";
  const isLocked = isFreePlan && item.proOnly;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.path}
          end
          className={cn(
            "relative hover:bg-sidebar-accent",
            active && "bg-sidebar-accent text-primary font-medium",
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
}
