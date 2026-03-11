import { PageContainer } from "@/components/layout/PageContainer";
import { EntityContextBar } from "@/components/classifications/EntityContextBar";
import { SncAccountMap } from "@/components/classifications/SncAccountMap";
import { AiClassificationQueue } from "@/components/classifications/AiClassificationQueue";
import { RulesMemoryPanel } from "@/components/classifications/RulesMemoryPanel";
import { TaxonomyMappingPanel } from "@/components/classifications/TaxonomyMappingPanel";
import { Button } from "@/components/ui/button";
import { Download, Settings2 } from "lucide-react";

export default function Classifications() {
  return (
    <PageContainer
      title="Classificações"
      subtitle="Centro de classificação SNC, mapeamento de contas e categorização assistida por IA"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            Configurar Perfil
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* Entity context strip */}
      <EntityContextBar />

      {/* Row 1: SNC Map + AI Queue */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SncAccountMap />
        <AiClassificationQueue />
      </div>

      {/* Row 2: Rules + Taxonomy */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RulesMemoryPanel />
        <TaxonomyMappingPanel />
      </div>
    </PageContainer>
  );
}
