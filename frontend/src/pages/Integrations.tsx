import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ExternalLink, CheckCircle2, AlertCircle, Clock, FileSearch, CreditCard, Lock, Webhook } from "lucide-react";

interface IntegrationCard {
  name: string;
  description: string;
  status: "connected" | "optional" | "pending";
  icon: React.ElementType;
  iconBg: string;
  docsUrl?: string;
  details: string[];
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    name: "Paperless-ngx",
    description: "Motor de OCR para processamento automático de documentos PDF e imagens.",
    status: "connected",
    icon: FileSearch,
    iconBg: "bg-tim-info/10 text-tim-info",
    docsUrl: "https://docs.paperless-ngx.com/",
    details: [
      "OCR em Português + Inglês (Tesseract)",
      "Webhook pós-consumo para ingestão automática",
      "Configurado via PAPERLESS_URL e PAPERLESS_TOKEN",
    ],
  },
  {
    name: "Clerk",
    description: "Autenticação multi-tenant com SSO, gestão de utilizadores e organizações.",
    status: "connected",
    icon: Lock,
    iconBg: "bg-purple-100 text-purple-600",
    docsUrl: "https://clerk.com/docs",
    details: [
      "JWT com validação de chave pública RSA",
      "Multi-tenant via organização Clerk",
      "Configurado via CLERK_PEM_PUBLIC_KEY",
    ],
  },
  {
    name: "Stripe",
    description: "Processamento de pagamentos e gestão de subscrições.",
    status: "connected",
    icon: CreditCard,
    iconBg: "bg-violet-100 text-violet-600",
    docsUrl: "https://stripe.com/docs",
    details: [
      "Checkout e portal de cliente",
      "Webhook de eventos de subscrição",
      "Configurado via STRIPE_SECRET_KEY",
    ],
  },
  {
    name: "Webhook Paperless",
    description: "Script de pós-consumo para ingestão automática de documentos processados.",
    status: "pending",
    icon: Webhook,
    iconBg: "bg-tim-warning/10 text-tim-warning",
    details: [
      "Variável PAPERLESS_POST_CONSUME_SCRIPT",
      "Aponta para bin/post-consume.sh",
      "Chama POST /api/webhook com document_id",
    ],
  },
];

const STATUS_CONFIG = {
  connected: { label: "Ligado", icon: CheckCircle2, className: "border-tim-success/30 bg-tim-success/10 text-tim-success" },
  optional: { label: "Opcional", icon: Clock, className: "border-muted text-muted-foreground" },
  pending: { label: "Verificar", icon: AlertCircle, className: "border-tim-warning/30 bg-tim-warning/10 text-tim-warning" },
};

export default function IntegrationsPage() {
  return (
    <PageContainer
      title="Integrações"
      subtitle="Serviços externos ligados à plataforma"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          const status = STATUS_CONFIG[integration.status];
          const StatusIcon = status.icon;
          const IntegrationIcon = integration.icon;

          return (
            <div key={integration.name} className="rounded-lg border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", integration.iconBg)}>
                    <IntegrationIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{integration.name}</h3>
                    <Badge
                      variant="outline"
                      className={cn("mt-0.5 gap-1 text-xs", status.className)}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </Badge>
                  </div>
                </div>
                {integration.docsUrl && (
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              <p className="mt-3 text-sm text-muted-foreground">{integration.description}</p>

              <ul className="mt-3 space-y-1">
                {integration.details.map((detail, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                    {detail}
                  </li>
                ))}
              </ul>

              {integration.docsUrl && (
                <div className="mt-4">
                  <a href={integration.docsUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      Documentação <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-lg border border-dashed bg-muted/20 p-5">
        <h3 className="text-sm font-semibold">Mais integrações em breve</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Integração bancária direta, AT (Portal das Finanças), e-Fatura e outros serviços portugueses estão em roadmap.
        </p>
      </div>
    </PageContainer>
  );
}

