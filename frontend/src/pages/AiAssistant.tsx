import { PageContainer } from "@/components/layout/PageContainer";
import { AskTimPanel } from "@/components/assistant/AskTimPanel";
import { SuggestedActionsQueue } from "@/components/assistant/SuggestedActionsQueue";
import { BiInsightsPanel } from "@/components/assistant/BiInsightsPanel";
import { CommunicationDrafts } from "@/components/assistant/CommunicationDrafts";
import { ComplianceAlertsFeed } from "@/components/alerts/ComplianceAlertsFeed";

export default function AiAssistant() {
  return (
    <PageContainer
      title="Assistente TIM"
      subtitle="Copiloto inteligente para operações financeiras e contabilísticas"
    >
      {/* Row 1: Ask TIM + Suggested Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AskTimPanel />
        <SuggestedActionsQueue />
      </div>

      {/* Row 2: Compliance Alerts + BI Insights */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ComplianceAlertsFeed />
        <BiInsightsPanel />
      </div>

      {/* Row 3: Communication Drafts */}
      <div className="mt-6">
        <CommunicationDrafts />
      </div>
    </PageContainer>
  );
}
