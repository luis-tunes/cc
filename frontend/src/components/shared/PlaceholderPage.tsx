import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/shared/EmptyState";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <PageContainer title={title} subtitle={subtitle}>
      <EmptyState
        icon={Construction}
        title="Em desenvolvimento"
        description="Esta funcionalidade está a ser construída. Estará disponível em breve."
      />
    </PageContainer>
  );
}
