import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TrialGate } from "@/components/billing/TrialGate";
import { UpgradeGate } from "@/components/billing/UpgradeGate";
import { AppLayout } from "@/components/layout/AppLayout";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Auth pages (small — keep eager)
import SignInPage from "@/pages/SignIn";
import SignUpPage from "@/pages/SignUp";

// Lazy-loaded app pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const InboxPage = lazy(() => import("@/pages/Inbox"));
const Documents = lazy(() => import("@/pages/Documents"));
const BankMovements = lazy(() => import("@/pages/BankMovements"));
const Reconciliation = lazy(() => import("@/pages/Reconciliation"));
const Classifications = lazy(() => import("@/pages/Classifications"));
const AutoClassification = lazy(() => import("@/pages/AutoClassification"));
const TaxCenter = lazy(() => import("@/pages/TaxCenter"));
const Obligations = lazy(() => import("@/pages/Obligations"));
const Assets = lazy(() => import("@/pages/Assets"));
const Reports = lazy(() => import("@/pages/Reports"));
const AiAssistant = lazy(() => import("@/pages/AiAssistant"));
const Insights = lazy(() => import("@/pages/Insights"));
const Forecasts = lazy(() => import("@/pages/Forecasts"));
const CostOptimization = lazy(() => import("@/pages/CostOptimization"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Products = lazy(() => import("@/pages/Products"));
const ShoppingList = lazy(() => import("@/pages/ShoppingList"));
const EntityProfile = lazy(() => import("@/pages/EntityProfile"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const GuidePage = lazy(() => import("@/pages/Guide"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const PricingPage = lazy(() => import("@/pages/Pricing"));
const ActivityFeed = lazy(() => import("@/pages/ActivityFeed"));
const LandingPage = lazy(() => import("@/pages/Landing"));
const PrivacyPage = lazy(() => import("@/pages/Privacy"));
const AdminPage = lazy(() => import("@/pages/Admin"));
const MonitoringPage = lazy(() => import("@/pages/Monitoring"));
const ChartOfAccounts = lazy(() => import("@/pages/ChartOfAccounts"));
const JournalEntries = lazy(() => import("@/pages/JournalEntries"));
const TrialBalance = lazy(() => import("@/pages/TrialBalance"));
const GeneralLedger = lazy(() => import("@/pages/GeneralLedger"));
const BalanceSheetPage = lazy(() => import("@/pages/BalanceSheet"));
const ProfitLossPage = lazy(() => import("@/pages/ProfitLoss"));
const CustomersPage = lazy(() => import("@/pages/Customers"));
const InvoicesPage = lazy(() => import("@/pages/Invoices"));
const AgedReceivablesPage = lazy(() => import("@/pages/AgedReceivables"));
const MovementRulesPage = lazy(() => import("@/pages/MovementRules"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const OnboardingPage = lazy(() => import("@/pages/Onboarding"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
    <TooltipProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/privacidade" element={<PrivacyPage />} />
          <Route path="/auth/sign-in/*" element={<SignInPage />} />
          <Route path="/auth/sign-up/*" element={<SignUpPage />} />

          {/* Pricing — protected but outside app layout (full-screen) */}
          <Route
            path="/planos"
            element={
              <ProtectedRoute>
                <PricingPage />
              </ProtectedRoute>
            }
          />

          {/* Onboarding — protected, full-page wizard */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Protected — inside layout, with trial gate */}
          <Route
            element={
              <ProtectedRoute>
                <TrialGate>
                  <AppLayout />
                </TrialGate>
              </ProtectedRoute>
            }
          >
            <Route path="/painel" element={<Dashboard />} />
            <Route path="/atividade" element={<UpgradeGate title="Atividade" subtitle="Histórico de ações"><ActivityFeed /></UpgradeGate>} />
            <Route path="/caixa-entrada" element={<InboxPage />} />
            <Route path="/documentos" element={<Documents />} />
            <Route path="/movimentos" element={<BankMovements />} />
            <Route path="/regras-movimentos" element={<UpgradeGate title="Regras de Movimentos" subtitle="Classificação automática de movimentos bancários"><MovementRulesPage /></UpgradeGate>} />
            <Route path="/reconciliacao" element={<UpgradeGate title="Reconciliação" subtitle="Correspondência entre documentos e movimentos bancários"><Reconciliation /></UpgradeGate>} />
            <Route path="/clientes" element={<UpgradeGate title="Clientes" subtitle="Gestão de clientes e parceiros"><CustomersPage /></UpgradeGate>} />
            <Route path="/faturas" element={<UpgradeGate title="Faturas" subtitle="Emissão e gestão de faturas"><InvoicesPage /></UpgradeGate>} />
            <Route path="/contas-receber" element={<UpgradeGate title="Contas a Receber" subtitle="Análise de antiguidade de faturas"><AgedReceivablesPage /></UpgradeGate>} />
            <Route path="/inventario" element={<UpgradeGate title="Inventário" subtitle="Gestão de stock e ingredientes"><Inventory /></UpgradeGate>} />
            <Route path="/fornecedores" element={<UpgradeGate title="Fornecedores" subtitle="Gestão de fornecedores"><Suppliers /></UpgradeGate>} />
            <Route path="/produtos" element={<UpgradeGate title="Produtos" subtitle="Gestão de produtos e receitas"><Products /></UpgradeGate>} />
            <Route path="/marmitas" element={<Navigate to="/produtos" replace />} />
            <Route path="/lista-compras" element={<UpgradeGate title="Lista de Compras" subtitle="Lista de compras automática"><ShoppingList /></UpgradeGate>} />
            <Route path="/classificacoes" element={<Classifications />} />
            <Route path="/auto-classificacao" element={<UpgradeGate title="Auto-Classificação" subtitle="Classificação automática de documentos"><AutoClassification /></UpgradeGate>} />
            <Route path="/centro-fiscal" element={<UpgradeGate title="Centro Fiscal" subtitle="IVA, IRC e obrigações fiscais"><TaxCenter /></UpgradeGate>} />
            <Route path="/obrigacoes" element={<UpgradeGate title="Obrigações Fiscais" subtitle="Calendário de prazos"><Obligations /></UpgradeGate>} />
            <Route path="/ativos" element={<UpgradeGate title="Ativos Fixos" subtitle="Gestão de imobilizado e depreciações"><Assets /></UpgradeGate>} />
            <Route path="/plano-contas" element={<UpgradeGate title="Plano de Contas" subtitle="Sistema de Normalização Contabilística"><ChartOfAccounts /></UpgradeGate>} />
            <Route path="/lancamentos" element={<UpgradeGate title="Lançamentos" subtitle="Diário de lançamentos contabilísticos"><JournalEntries /></UpgradeGate>} />
            <Route path="/balancete" element={<UpgradeGate title="Balancete" subtitle="Balancete de verificação"><TrialBalance /></UpgradeGate>} />
            <Route path="/razao" element={<UpgradeGate title="Razão" subtitle="Razão geral por conta"><GeneralLedger /></UpgradeGate>} />
            <Route path="/balanco" element={<UpgradeGate title="Balanço" subtitle="Balanço patrimonial"><BalanceSheetPage /></UpgradeGate>} />
            <Route path="/dem-resultados" element={<UpgradeGate title="Dem. Resultados" subtitle="Demonstração de Resultados"><ProfitLossPage /></UpgradeGate>} />
            <Route path="/relatorios" element={<UpgradeGate title="Relatórios" subtitle="Demonstração de resultados e análise"><Reports /></UpgradeGate>} />
            <Route path="/assistente" element={<UpgradeGate title="Assistente IA" subtitle="Consultas em linguagem natural"><AiAssistant /></UpgradeGate>} />
            <Route path="/insights" element={<UpgradeGate title="Insights" subtitle="Análises financeiras"><Insights /></UpgradeGate>} />
            <Route path="/previsoes" element={<UpgradeGate title="Previsões" subtitle="Projeções de cash flow"><Forecasts /></UpgradeGate>} />
            <Route path="/otimizacao" element={<UpgradeGate title="Otimização de Custos" subtitle="Análise de despesas"><CostOptimization /></UpgradeGate>} />
            <Route path="/entidade" element={<ErrorBoundary><EntityProfile /></ErrorBoundary>} />
            <Route path="/definicoes" element={<SettingsPage />} />
            <Route path="/guia" element={<GuidePage />} />
            <Route path="/perfil" element={<ErrorBoundary><UserProfile /></ErrorBoundary>} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/monitoring" element={<MonitoringPage />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </TooltipProvider>
    </ErrorBoundary>
  );
}
