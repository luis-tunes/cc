import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Upload,
  Bot,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
} from "lucide-react";
import { uploadDocumentStaging, processDocument, saveEntity } from "@/lib/api";
import { toast } from "sonner";

interface CompanyInfo {
  name: string;
  nif: string;
  address: string;
  cae: string;
  vatRegime: string;
  accountingSoftware: string;
}

const VAT_REGIMES = [
  { value: "normal_trimestral", label: "Normal trimestral" },
  { value: "normal_mensal", label: "Normal mensal" },
  { value: "isencao_art53", label: "Isenção Art. 53º" },
  { value: "regime_especial", label: "Regime especial" },
];

const ACCOUNTING_SOFTWARE = [
  { value: "primavera", label: "Primavera" },
  { value: "phc", label: "PHC" },
  { value: "sage", label: "Sage" },
  { value: "cegid", label: "Cegid Jasmin" },
  { value: "outro", label: "Outro" },
  { value: "nenhum", label: "Nenhum" },
];

const STEP_LABELS = [
  "Empresa",
  "Carregar",
  "Classificar",
  "Rever",
];

function validateNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * weights[i];
  }
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  return checkDigit === parseInt(nif[8]);
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [company, setCompany] = useState<CompanyInfo>({
    name: "",
    nif: "",
    address: "",
    cae: "",
    vatRegime: "",
    accountingSoftware: "",
  });
  const [uploadedFile, setUploadedFile] = useState<{ id: number; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [classificationResult, setClassificationResult] = useState<{
    type: string;
    nif: string;
    total: string;
    vat: string;
    account: string;
  } | null>(null);
  const [showFields, setShowFields] = useState(0);
  const [approved, setApproved] = useState(false);

  const progressPercent = ((step + 1) / 4) * 100;

  const canAdvance = () => {
    if (step === 0) return company.name.trim() !== "" && company.nif.length === 9 && validateNif(company.nif) && company.vatRegime !== "";
    if (step === 1) return uploadedFile !== null;
    if (step === 2) return classificationResult !== null;
    if (step === 3) return approved;
    return false;
  };

  const handleSaveCompany = useCallback(async () => {
    try {
      await saveEntity({
        name: company.name,
        nif: company.nif,
        address: company.address,
        cae: company.cae,
        vatRegime: company.vatRegime,
        accountingSoftware: company.accountingSoftware,
      });
    } catch {
      // Non-blocking — entity save can fail silently on onboarding
    }
  }, [company]);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadDocumentStaging(file);
      setUploadedFile({ id: result.id, name: result.filename });
      toast.success("Documento carregado com sucesso");
      // Auto-advance to step 3 after 1s
      setTimeout(() => setStep(2), 1000);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar documento");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleProcess = useCallback(async () => {
    if (!uploadedFile) return;
    setIsProcessing(true);
    setShowFields(0);
    try {
      await processDocument(uploadedFile.id);
      // Simulate the staggered field reveal
      const fakeResult = {
        type: "Fatura (FT)",
        nif: "509 123 456",
        total: "€1.250,00",
        vat: "€287,50",
        account: "Conta 62 — FSE",
      };
      for (let i = 1; i <= 5; i++) {
        setTimeout(() => setShowFields(i), i * 400);
      }
      setTimeout(() => {
        setClassificationResult(fakeResult);
      }, 2500);
    } catch {
      toast.error("Erro ao processar documento");
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFile]);

  const handleNext = useCallback(async () => {
    if (step === 0) {
      await handleSaveCompany();
      setStep(1);
    } else if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      if (!classificationResult) {
        await handleProcess();
      } else {
        setStep(3);
      }
    } else if (step === 3) {
      navigate("/painel");
    }
  }, [step, handleSaveCompany, classificationResult, handleProcess, navigate]);

  const handleSkip = useCallback(() => {
    navigate("/painel");
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">xtim.ai</span>
          </div>
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Saltar e explorar sozinho →
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="border-b border-border bg-card px-6 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  i < step ? "bg-primary text-primary-foreground" :
                  i === step ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn(
                  "text-xs font-medium hidden sm:inline",
                  i <= step ? "text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>
      </div>

      {/* Step content */}
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-xl">
          {/* Step 1: Company Info */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <Building2 className="mx-auto h-10 w-10 text-primary/60" />
                <h2 className="mt-4 text-xl font-bold">Informação da Empresa</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Estes dados melhoram a precisão da classificação automática.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nome da empresa *</label>
                  <Input
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    placeholder="Ex: Restaurante O Marinheiro, Lda."
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">NIF *</label>
                  <Input
                    value={company.nif}
                    onChange={(e) => setCompany({ ...company, nif: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                    placeholder="9 dígitos"
                    className="mt-1"
                    maxLength={9}
                  />
                  {company.nif.length === 9 && !validateNif(company.nif) && (
                    <p className="mt-1 text-xs text-tim-danger">NIF inválido — verifique os dígitos</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Morada da sede</label>
                  <Input
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    placeholder="Opcional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">CAE principal</label>
                  <Input
                    value={company.cae}
                    onChange={(e) => setCompany({ ...company, cae: e.target.value })}
                    placeholder="Ex: 56101 (Restauração)"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Regime de IVA *</label>
                  <Select value={company.vatRegime} onValueChange={(v) => setCompany({ ...company, vatRegime: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecionar regime…" />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_REGIMES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Software de contabilidade</label>
                  <Select value={company.accountingSoftware} onValueChange={(v) => setCompany({ ...company, accountingSoftware: v })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNTING_SOFTWARE.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <Upload className="mx-auto h-10 w-10 text-primary/60" />
                <h2 className="mt-4 text-xl font-bold">Carregue o seu primeiro documento</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Arraste uma fatura, recibo, ou outro documento financeiro
                </p>
              </div>

              <div
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 transition-all hover:border-primary/40 hover:bg-secondary/30",
                  uploadedFile ? "border-tim-success bg-tim-success/5" : "border-border"
                )}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,.jpg,.jpeg,.png,.tiff,.tif";
                  input.onchange = (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileUpload(file);
                  };
                  input.click();
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                {uploadedFile ? (
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-tim-success" />
                    <div>
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-tim-success">Carregado com sucesso</p>
                    </div>
                  </div>
                ) : isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">A carregar…</p>
                  </div>
                ) : (
                  <>
                    <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Arrastar ficheiro ou clicar para selecionar</p>
                    <p className="mt-1 text-xs text-muted-foreground">PDF, JPG, PNG — máximo 10MB</p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Classification */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <Bot className="mx-auto h-10 w-10 text-primary/60" />
                <h2 className="mt-4 text-xl font-bold">Veja a IA a classificar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O TIM está a analisar o seu documento…
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-12 items-center justify-center rounded bg-muted">
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-3">
                    {!classificationResult && !isProcessing && (
                      <Button onClick={handleProcess} className="w-full">
                        <Bot className="mr-2 h-4 w-4" />
                        Iniciar classificação
                      </Button>
                    )}
                    {(isProcessing || showFields > 0) && (
                      <>
                        {showFields === 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            A analisar documento…
                          </div>
                        )}
                        {showFields >= 1 && (
                          <div className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground">Tipo:</span>
                            <span className="font-medium">Fatura (FT)</span>
                          </div>
                        )}
                        {showFields >= 2 && (
                          <div className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground">NIF:</span>
                            <span className="font-mono">509 123 456</span>
                          </div>
                        )}
                        {showFields >= 3 && (
                          <div className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-mono font-medium">€1.250,00</span>
                          </div>
                        )}
                        {showFields >= 4 && (
                          <div className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground">IVA:</span>
                            <span className="font-mono">€287,50</span>
                          </div>
                        )}
                        {showFields >= 5 && (
                          <div className="flex items-center justify-between text-sm rounded-md bg-tim-success/10 px-3 py-2 animate-in fade-in slide-in-from-bottom-2">
                            <span className="text-muted-foreground">Classificação IA:</span>
                            <span className="font-medium text-tim-success">Conta 62 — FSE</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Approve */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary/60" />
                <h2 className="mt-4 text-xl font-bold">Reveja e aprove</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Confirme a classificação ou ajuste manualmente.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-6 space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Tipo:</span><span className="font-medium">Fatura (FT)</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">NIF:</span><span className="font-mono">509 123 456</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-mono font-medium">€1.250,00</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IVA:</span><span className="font-mono">€287,50</span></div>
                  <div className="flex justify-between rounded-md bg-tim-success/10 px-3 py-2">
                    <span className="text-muted-foreground">Classificação:</span>
                    <span className="font-medium text-tim-success">Conta 62 — FSE</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-tim-success hover:bg-tim-success/90"
                    onClick={() => {
                      setApproved(true);
                      toast.success("Classificação aprovada! 🎉");
                    }}
                    disabled={approved}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    {approved ? "Aprovado ✓" : "Aprovar classificação"}
                  </Button>
                </div>

                {approved && (
                  <div className="rounded-md bg-primary/5 border border-primary/20 p-4 text-center animate-in fade-in">
                    <p className="text-sm font-medium">🎉 Parabéns! O seu primeiro documento está processado.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer navigation */}
      <footer className="border-t border-border bg-card px-6 py-4">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canAdvance()}
          >
            {step === 3
              ? (approved ? "Ir para o painel" : "Aprovar primeiro")
              : "Continuar"}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
