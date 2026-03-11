import { PageContainer } from "@/components/layout/PageContainer";
import { IvaOverviewPanel } from "@/components/tax/IvaOverviewPanel";
import { IrcOverviewPanel } from "@/components/tax/IrcOverviewPanel";
import { ObligationsTimeline } from "@/components/tax/ObligationsTimeline";
import { FilingReadinessBoard } from "@/components/tax/FilingReadinessBoard";
import { AuditFlagsPanel } from "@/components/tax/AuditFlagsPanel";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

export default function TaxCenter() {
  return (
    <PageContainer
      title="Centro Fiscal"
      subtitle="Visibilidade de IVA, IRC e obrigações fiscais — preparação e conformidade"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Relatório Fiscal
          </Button>
          <Button variant="outline" size="sm" className="text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Exportar
          </Button>
        </div>
      }
    >
      {/* Row 1: IVA + IRC */}
      <div className="grid gap-6 lg:grid-cols-2">
        <IvaOverviewPanel />
        <IrcOverviewPanel />
      </div>

      {/* Row 2: Obligations + Filing readiness */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ObligationsTimeline />
        <FilingReadinessBoard />
      </div>

      {/* Row 3: Audit flags full width */}
      <div className="mt-6">
        <AuditFlagsPanel />
      </div>
    </PageContainer>
  );
}
