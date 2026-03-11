import { Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

// Auth pages
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";

// App pages
import Dashboard from "@/pages/Dashboard";
import ActivityFeed from "@/pages/ActivityFeed";
import InboxPage from "@/pages/Inbox";
import Documents from "@/pages/Documents";
import BankMovements from "@/pages/BankMovements";
import Reconciliation from "@/pages/Reconciliation";
import Classifications from "@/pages/Classifications";
import AutoClassification from "@/pages/AutoClassification";
import TaxCenter from "@/pages/TaxCenter";
import Obligations from "@/pages/Obligations";
import Assets from "@/pages/Assets";
import Reports from "@/pages/Reports";
import AiAssistant from "@/pages/AiAssistant";
import Insights from "@/pages/Insights";
import Forecasts from "@/pages/Forecasts";
import CostOptimization from "@/pages/CostOptimization";
import EntityProfile from "@/pages/EntityProfile";
import IntegrationsPage from "@/pages/Integrations";
import SettingsPage from "@/pages/Settings";
import UserProfile from "@/pages/UserProfile";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <TooltipProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/painel" replace />} />
        <Route path="/auth/sign-in/*" element={<SignInPage />} />
        <Route path="/auth/sign-up/*" element={<SignUpPage />} />

        {/* Protected — inside layout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/painel" element={<Dashboard />} />
          <Route path="/atividade" element={<ActivityFeed />} />
          <Route path="/caixa-entrada" element={<InboxPage />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="/movimentos" element={<BankMovements />} />
          <Route path="/reconciliacao" element={<Reconciliation />} />
          <Route path="/classificacoes" element={<Classifications />} />
          <Route path="/auto-classificacao" element={<AutoClassification />} />
          <Route path="/centro-fiscal" element={<TaxCenter />} />
          <Route path="/obrigacoes" element={<Obligations />} />
          <Route path="/ativos" element={<Assets />} />
          <Route path="/relatorios" element={<Reports />} />
          <Route path="/assistente" element={<AiAssistant />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/previsoes" element={<Forecasts />} />
          <Route path="/otimizacao" element={<CostOptimization />} />
          <Route path="/entidade" element={<EntityProfile />} />
          <Route path="/integracoes" element={<IntegrationsPage />} />
          <Route path="/definicoes" element={<SettingsPage />} />
          <Route path="/perfil" element={<UserProfile />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  );
}
