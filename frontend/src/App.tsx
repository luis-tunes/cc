import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { TrialGate } from "@/components/billing/TrialGate";
import { AppLayout } from "@/components/layout/AppLayout";
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
const IntegrationsPage = lazy(() => import("@/pages/Integrations"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const PricingPage = lazy(() => import("@/pages/Pricing"));
const ActivityFeed = lazy(() => import("@/pages/ActivityFeed"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
    </div>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Navigate to="/painel" replace />} />
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
            <Route path="/atividade" element={<ActivityFeed />} />
            <Route path="/caixa-entrada" element={<InboxPage />} />
            <Route path="/documentos" element={<Documents />} />
            <Route path="/movimentos" element={<BankMovements />} />
            <Route path="/reconciliacao" element={<Reconciliation />} />
            <Route path="/inventario" element={<Inventory />} />
            <Route path="/fornecedores" element={<Suppliers />} />
            <Route path="/marmitas" element={<Products />} />
            <Route path="/lista-compras" element={<ShoppingList />} />
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
      </Suspense>
    </TooltipProvider>
  );
}
