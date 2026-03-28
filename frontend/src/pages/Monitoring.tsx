import { PageContainer } from "@/components/layout/PageContainer";

export default function Monitoring() {
  return (
    <PageContainer title="Monitorização" subtitle="Dashboard de infraestrutura e métricas">
      <div className="-mx-4 -mb-6 sm:-mx-6">
        <iframe
          src="/api/monitoring"
          title="Monitoring Dashboard"
          className="h-[calc(100vh-12rem)] w-full border-0"
          allow="clipboard-write"
        />
      </div>
    </PageContainer>
  );
}
