import { cn } from "@/lib/utils";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  defaultEntityData,
  entityCategories,
  accountingRegimes,
  vatRegimes,
  complianceImpacts,
  setupSteps,
  type EntityData,
} from "@/lib/entity-data";
import {
  Building2, Hash, MapPin, ChevronRight, ChevronLeft, Check,
  AlertTriangle, Info, Sparkles, BookOpen, Receipt, Users,
  Mail, Shield, Save, BarChart3,
} from "lucide-react";
import { toast } from "sonner";

export default function EntityProfile() {
  const [data, setData] = useState<EntityData>(defaultEntityData);
  const [activeStep, setActiveStep] = useState(1);
  const [isEditing, setIsEditing] = useState(false);

  const update = (field: keyof EntityData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const totalSteps = setupSteps.length;
  const progressPct = Math.round((activeStep / totalSteps) * 100);

  const recommendedCategory = entityCategories.find((c) => c.value === data.entityCategory);

  return (
    <PageContainer
      title="Perfil da Entidade"
      subtitle="Configuração da empresa — contexto fiscal, contabilístico e operacional"
      actions={
        <Button size="sm" className="text-xs" onClick={() => { toast.success("Perfil guardado"); setIsEditing(false); }}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          Guardar Perfil
        </Button>
      }
    >
      {/* Step progress */}
      <div className="rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Configuração</span>
          <span className="text-[10px] font-semibold text-primary tabular-nums">{activeStep}/{totalSteps}</span>
        </div>
        <Progress value={progressPct} className="h-1.5 bg-muted mb-3" />
        <div className="flex gap-1">
          {setupSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-left transition-colors",
                activeStep === step.id ? "bg-primary/10 border border-primary/30" : "hover:bg-accent/50",
                step.id < activeStep && "opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                {step.id < activeStep ? (
                  <Check className="h-3.5 w-3.5 text-tim-success" />
                ) : (
                  <span className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    activeStep === step.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{step.id}</span>
                )}
                <div>
                  <p className={cn("text-[11px] font-medium", activeStep === step.id ? "text-foreground" : "text-muted-foreground")}>{step.title}</p>
                  <p className="text-[9px] text-muted-foreground hidden sm:block">{step.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Main form area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Identification */}
          {activeStep === 1 && (
            <div className="rounded-lg border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Identificação da Entidade</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Dados legais e fiscais da empresa. Estes campos identificam a entidade perante a AT e determinam as obrigações aplicáveis.</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Designação Social" value={data.legalName} onChange={(v) => update("legalName", v)} icon={Building2} />
                <FormField label="NIF" value={data.nif} onChange={(v) => update("nif", v)} icon={Hash} hint="Número de Identificação Fiscal" />
                <FormField label="CAE Principal" value={data.cae} onChange={(v) => update("cae", v)} icon={BarChart3} />
                <FormField label="Descrição CAE" value={data.caeDescription} onChange={(v) => update("caeDescription", v)} disabled />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Morada" value={data.address} onChange={(v) => update("address", v)} icon={MapPin} />
                <FormField label="Código Postal" value={data.postalCode} onChange={(v) => update("postalCode", v)} />
                <FormField label="Cidade" value={data.city} onChange={(v) => update("city", v)} />
              </div>
            </div>
          )}

          {/* Step 2: Regime */}
          {activeStep === 2 && (
            <div className="rounded-lg border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Enquadramento Fiscal e Contabilístico</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">A categoria e regime determinam quais demonstrações financeiras, taxonomias e obrigações se aplicam.</p>

              {/* Entity category selector */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-2 block">Categoria da Entidade</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {entityCategories.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => update("entityCategory", cat.value)}
                      className={cn(
                        "rounded-md border px-3 py-2.5 text-left transition-all",
                        data.entityCategory === cat.value
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{cat.label}</p>
                        {data.entityCategory === cat.value && <Check className="h-3.5 w-3.5 text-primary ml-auto" />}
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{cat.description}</p>
                      <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{cat.regime}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Regime Contabilístico"
                  value={data.accountingRegime}
                  onChange={(v) => update("accountingRegime", v)}
                  options={accountingRegimes}
                />
                <SelectField
                  label="Regime de IVA"
                  value={data.vatRegime}
                  onChange={(v) => update("vatRegime", v)}
                  options={vatRegimes}
                />
              </div>
            </div>
          )}

          {/* Step 3: Operations */}
          {activeStep === 3 && (
            <div className="rounded-lg border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Dimensão e Operação</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Estes dados ajudam a recomendar a categoria da entidade e a calibrar alertas e previsões.</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Número de Empregados"
                  value={data.employees}
                  onChange={(v) => update("employees", v)}
                  options={[
                    { value: "1-4", label: "1–4", description: "" },
                    { value: "5-10", label: "5–10", description: "" },
                    { value: "11-50", label: "11–50", description: "" },
                    { value: "51-250", label: "51–250", description: "" },
                    { value: "250+", label: "250+", description: "" },
                  ]}
                />
                <SelectField
                  label="Volume de Negócios Anual"
                  value={data.turnoverRange}
                  onChange={(v) => update("turnoverRange", v)}
                  options={[
                    { value: "0-15k", label: "≤ €15.000", description: "" },
                    { value: "15k-150k", label: "€15k – €150k", description: "" },
                    { value: "150k-350k", label: "€150k – €350k", description: "" },
                    { value: "350k-700k", label: "€350k – €700k", description: "" },
                    { value: "700k-8M", label: "€700k – €8M", description: "" },
                    { value: "8M+", label: "> €8M", description: "" },
                  ]}
                />
                <SelectField
                  label="Total de Balanço"
                  value={data.balanceSheetRange}
                  onChange={(v) => update("balanceSheetRange", v)}
                  options={[
                    { value: "0-350k", label: "≤ €350k", description: "" },
                    { value: "100k-350k", label: "€100k – €350k", description: "" },
                    { value: "350k-4M", label: "€350k – €4M", description: "" },
                    { value: "4M-20M", label: "€4M – €20M", description: "" },
                    { value: "20M+", label: "> €20M", description: "" },
                  ]}
                />
                <SelectField
                  label="Frequência de Reporte"
                  value={data.reportingFrequency}
                  onChange={(v) => update("reportingFrequency", v)}
                  options={[
                    { value: "mensal", label: "Mensal", description: "" },
                    { value: "trimestral", label: "Trimestral", description: "" },
                    { value: "anual", label: "Anual", description: "" },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Step 4: Accountant */}
          {activeStep === 4 && (
            <div className="rounded-lg border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Contabilista Certificado</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Dados do contabilista certificado responsável. Usado para resumos automáticos e comunicação.</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Nome" value={data.accountantName} onChange={(v) => update("accountantName", v)} icon={Users} />
                <FormField label="Email" value={data.accountantEmail} onChange={(v) => update("accountantEmail", v)} icon={Mail} />
                <FormField label="NIF do Contabilista" value={data.accountantNif} onChange={(v) => update("accountantNif", v)} icon={Hash} />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs font-medium text-foreground">Representante Fiscal</h4>
                  <span className="text-[9px] text-muted-foreground">(se aplicável)</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Nome" value={data.fiscalRepName} onChange={(v) => update("fiscalRepName", v)} placeholder="Não definido" />
                  <FormField label="NIF" value={data.fiscalRepNif} onChange={(v) => update("fiscalRepNif", v)} placeholder="Não definido" />
                </div>
                {!data.fiscalRepName && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-tim-warning/5 border border-tim-warning/20 px-3 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-tim-warning mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground">
                      Representante fiscal necessário se a sede for fora de Portugal ou se existirem sócios não-residentes com obrigações fiscais.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" className="text-xs" disabled={activeStep === 1} onClick={() => setActiveStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Anterior
            </Button>
            {activeStep < totalSteps ? (
              <Button size="sm" className="text-xs" onClick={() => setActiveStep((s) => s + 1)}>
                Seguinte
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="text-xs" onClick={() => toast.success("Configuração completa!")}>
                <Check className="mr-1 h-3.5 w-3.5" />
                Concluir
              </Button>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Recommended category */}
          {recommendedCategory && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-primary">Categoria Recomendada</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{recommendedCategory.label}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{recommendedCategory.description}</p>
              <div className="mt-2 rounded bg-muted/50 px-2 py-1">
                <span className="text-[10px] font-medium text-primary">{recommendedCategory.regime}</span>
              </div>
            </div>
          )}

          {/* Compliance impact */}
          <div className="rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Info className="h-4 w-4 text-tim-info" />
              <h3 className="text-sm font-semibold text-foreground">Impacto na Conformidade</h3>
            </div>
            <div className="p-3 space-y-2">
              {complianceImpacts.map((ci, i) => (
                <div key={i} className={cn(
                  "rounded-md border px-3 py-2",
                  ci.type === "warning" ? "border-tim-warning/30 bg-tim-warning/5" : "border-border"
                )}>
                  <div className="flex items-center gap-2">
                    {ci.type === "warning" ? (
                      <AlertTriangle className="h-3 w-3 text-tim-warning shrink-0" />
                    ) : (
                      <Info className="h-3 w-3 text-tim-info shrink-0" />
                    )}
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-medium text-foreground">{ci.field}</span>
                      <span className="text-[9px] text-muted-foreground">— {ci.condition}</span>
                    </div>
                  </div>
                  <p className="mt-1 pl-5 text-[10px] text-muted-foreground">{ci.impact}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick profile summary */}
          <div className="rounded-lg border bg-card p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">Resumo do Perfil</h3>
            <div className="space-y-2">
              <SummaryRow label="Entidade" value={data.legalName} />
              <SummaryRow label="NIF" value={data.nif} />
              <SummaryRow label="CAE" value={`${data.cae} — ${data.caeDescription}`} />
              <SummaryRow label="Regime" value={accountingRegimes.find((r) => r.value === data.accountingRegime)?.label || "—"} />
              <SummaryRow label="IVA" value={vatRegimes.find((r) => r.value === data.vatRegime)?.label || "—"} />
              <SummaryRow label="Contabilista" value={data.accountantName || "—"} />
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function FormField({
  label, value, onChange, icon: Icon, hint, placeholder, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void;
  icon?: any; hint?: string; placeholder?: string; disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      <div className="relative">
        {Icon && <Icon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("h-9 text-xs bg-muted/30", Icon && "pl-8")}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      {hint && <p className="mt-0.5 text-[9px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string; description: string }[];
}) {
  return (
    <div>
      <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs bg-muted/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              <div>
                <span>{opt.label}</span>
                {opt.description && <span className="ml-2 text-muted-foreground text-[10px]">{opt.description}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[10px] font-medium text-foreground text-right truncate">{value}</span>
    </div>
  );
}
