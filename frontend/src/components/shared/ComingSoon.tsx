import { cn } from "@/lib/utils";
import { Lock, type LucideIcon } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";

interface ComingSoonProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
}

export function ComingSoon({ title, subtitle, icon: Icon }: ComingSoonProps) {
  return (
    <PageContainer title={title} subtitle={subtitle}>
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-20 text-center">
        <div className="rounded-xl bg-muted p-4">
          {Icon ? (
            <div className="relative">
              <Icon className="h-8 w-8 text-muted-foreground/60" />
              <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ) : (
            <Lock className="h-8 w-8 text-muted-foreground/60" />
          )}
        </div>
        <h3 className="mt-5 text-base font-semibold text-foreground">
          Brevemente disponível
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          Esta funcionalidade está em desenvolvimento e será disponibilizada em breve.
          Estamos a trabalhar para lhe oferecer a melhor experiência possível.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          <span className="text-xs font-medium text-primary">Em desenvolvimento</span>
        </div>
      </div>
    </PageContainer>
  );
}
