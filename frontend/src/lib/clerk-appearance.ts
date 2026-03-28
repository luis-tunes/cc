/**
 * Shared Clerk appearance configuration for xtim.ai brand.
 * Applied globally via ClerkProvider and overridden per-component where needed.
 */
export const clerkAppearance = {
  layout: {
    socialButtonsPlacement: "top",
    showOptionalFields: false,
    logoPlacement: "none",
  },
  variables: {
    colorPrimary: "hsl(40 75% 48%)",
    colorDanger: "hsl(0 72% 48%)",
    colorSuccess: "hsl(152 55% 38%)",
    colorWarning: "hsl(30 85% 48%)",
    colorTextOnPrimaryBackground: "hsl(0 0% 100%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInputBackground: "hsl(220 10% 94%)",
    colorInputText: "hsl(220 15% 15%)",
    borderRadius: "0.625rem",
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: "0.875rem",
  },
  elements: {
    rootBox: "mx-auto",
    card: "bg-card border border-border shadow-lg rounded-xl",
    headerTitle: "text-foreground text-base font-semibold",
    headerSubtitle: "text-muted-foreground text-sm",
    socialButtonsBlockButton:
      "border-border bg-card text-foreground hover:bg-muted transition-colors",
    socialButtonsBlockButtonText: "text-sm font-medium",
    formFieldLabel: "text-foreground text-sm font-medium",
    formFieldInput:
      "bg-muted border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring rounded-md",
    formFieldInputShowPasswordButton: "text-muted-foreground hover:text-foreground",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm font-semibold text-sm",
    formButtonReset: "text-primary hover:text-primary/80 text-sm",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    identityPreviewEditButton: "text-primary hover:text-primary/80",
    alertText: "text-sm",
    badge: "hidden",
    footer: "hidden",
    footerAction: "hidden",
    dividerLine: "bg-border",
    dividerText: "text-muted-foreground text-xs",
    otpCodeFieldInput: "border-border bg-muted text-foreground",
    formResendCodeLink: "text-primary hover:text-primary/80",
    userButtonPopoverCard: "bg-card border-border shadow-lg",
    userButtonPopoverActionButton: "text-foreground hover:bg-muted",
    userButtonPopoverActionButtonText: "text-sm",
    userButtonPopoverFooter: "hidden",
    organizationSwitcherTrigger:
      "border-border bg-card text-foreground hover:bg-muted transition-colors text-sm",
    organizationSwitcherPopoverCard: "bg-card border-border shadow-lg",
    organizationSwitcherPopoverActionButton: "text-foreground hover:bg-muted",
    organizationSwitcherPopoverFooter: "hidden",
    organizationProfilePage: "text-foreground",
    membersPageInviteButton:
      "bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold",
    tableHead: "text-xs uppercase tracking-wider text-muted-foreground",
    navbar: "border-border",
    navbarButton: "text-foreground hover:bg-muted text-sm",
    profileSectionTitle:
      "text-xs font-semibold text-foreground uppercase tracking-wider",
    profileSectionContent: "text-sm text-foreground",
    profileSectionPrimaryButton: "text-xs text-primary hover:text-primary/80",
    pageScrollBox: "p-0",
  },
};

/** Appearance for inline Organization Profile (Settings page - embedded, no chrome). */
export const orgProfileAppearance = {
  elements: {
    rootBox: "w-full [&_.cl-organizationProfile-root]:w-full",
    card: "bg-transparent shadow-none border-0 p-0 m-0",
    navbar: "!hidden",
    navbarMobileMenuButton: "!hidden",
    headerTitle: "text-foreground text-sm font-semibold",
    headerSubtitle: "text-muted-foreground text-xs",
    page: "w-full gap-4",
    pageScrollBox: "p-0",
    profilePage: "w-full",
    profileSectionTitle:
      "text-xs font-semibold text-muted-foreground uppercase tracking-wider",
    profileSectionContent: "text-sm text-foreground",
    profileSectionPrimaryButton: "text-xs text-primary hover:text-primary/80 font-medium",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold",
    formFieldLabel: "text-xs text-muted-foreground font-medium",
    formFieldInput: "bg-background border-border text-foreground text-sm rounded-md",
    membersPageInviteButton:
      "bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold",
    tableHead: "text-xs uppercase tracking-wider text-muted-foreground",
    badge: "text-xs",
    accordionTriggerButton: "text-sm text-foreground hover:bg-muted/50",
    breadcrumbs: "hidden",
    breadcrumbsItem: "hidden",
  },
};

/** Appearance for sidebar OrganizationSwitcher. */
export const sidebarOrgSwitcherAppearance = {
  elements: {
    rootBox: "w-full",
    organizationSwitcherTrigger:
      "w-full justify-between rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-1.5 text-xs text-foreground hover:bg-sidebar-accent transition-colors",
    organizationSwitcherPopoverCard: "bg-card border-border shadow-lg",
    organizationSwitcherPopoverFooter: "hidden",
  },
};
