import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchClassificationSuggestion, fetchAuthenticatedBlob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type StatusType } from "@/components/shared/StatusBadge";
import { HelpTooltip } from "@/components/shared/HelpTooltip";
import {
  FileText,
  Image,
  CheckCircle2,
  AlertTriangle,
  Bot,
  X,
  Check,
  Eye,
  Tags,
  ArrowRight,
  Archive,
  ThumbsDown,
  RotateCcw,
  MessageSquare,
  Trash2,
} from "lucide-react";
import type { DocumentRecord, ExtractedField } from "@/lib/documents-data";
import { documentTypeLabels, type DocumentType } from "@/lib/documents-data";
import { documentThumbnailUrl, documentPreviewUrl } from "@/lib/api";

// SNC account options for reclassification
const SNC_ACCOUNTS = [
  { value: "62", label: "62 — Fornecimentos e Serviços Externos" },
  { value: "31", label: "31 — Compras" },
  { value: "71", label: "71 — Vendas" },
  { value: "72", label: "72 — Prestações de Serviços" },
  { value: "43", label: "43 — Ativos Fixos Tangíveis" },
  { value: "24", label: "24 — Estado e Outros Entes Públicos" },
  { value: "21", label: "21 — Clientes" },
  { value: "22", label: "22 — Fornecedores" },
  { value: "63", label: "63 — Gastos com o Pessoal" },
  { value: "69", label: "69 — Gastos e Perdas de Financiamento" },
];

export interface DocumentActions {
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onReclassify: (id: string, newAccount: string, newDocType?: DocumentType | string) => void;
  onConfirmField: (docId: string, fieldIndex: number) => void;
  onArchive: (id: string) => void;
  onAcceptAiSuggestion: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onReprocess: (id: string) => void;
}

interface DocumentReviewDrawerProps {
  document: DocumentRecord | null;
  open: boolean;
  onClose: () => void;
  actions: DocumentActions;
}

export function DocumentReviewDrawer({
  document,
  open,
  onClose,
  actions,
}: DocumentReviewDrawerProps) {
  const [showReclassify, setShowReclassify] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | "">("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const thumbnailUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Fetch thumbnail and preview with auth headers
  useEffect(() => {
    if (!open || !document) return;
    setThumbnailUrl(null);
    setPreviewUrl(null);
    setPreviewError(false);

    fetchAuthenticatedBlob(documentThumbnailUrl(Number(document.id)))
      .then((url) => { thumbnailUrlRef.current = url; setThumbnailUrl(url); })
      .catch(() => setPreviewError(true));

    fetchAuthenticatedBlob(documentPreviewUrl(Number(document.id)))
      .then((url) => { previewUrlRef.current = url; setPreviewUrl(url); })
      .catch(() => {});

    return () => {
      // Revoke old blob URLs on cleanup using refs (avoid stale closure)
      if (thumbnailUrlRef.current) URL.revokeObjectURL(thumbnailUrlRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      thumbnailUrlRef.current = null;
      previewUrlRef.current = null;
    };
  }, [open, document?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: suggestion } = useQuery({
    queryKey: ["doc-suggest", document?.id],
    queryFn: () => fetchClassificationSuggestion(Number(document!.id)),
    enabled: open && !!document && document.classificationStatus !== "revisto" && document.classificationStatus !== "classificado" && document.classificationStatus !== "arquivado",
    staleTime: 30_000,
  });

  if (!document) return null;

  const FileIcon = document.fileType === "pdf" ? FileText : Image;
  const isLowConf = document.extractionConfidence < 60;
  const isApproved = document.classificationStatus === "revisto" || document.classificationStatus === "classificado";
  const isArchived = document.classificationStatus === "arquivado";

  const resetPanels = () => {
    setShowReclassify(false);
    setShowReject(false);
    setShowNote(false);
    setShowDeleteConfirm(false);
    setSelectedAccount("");
    setSelectedDocType("");
    setRejectReason("");
    setNoteText("");
    setPreviewError(false);
  };

  const handleApprove = () => {
    actions.onApprove(document.id);
    resetPanels();
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    actions.onReject(document.id, rejectReason);
    resetPanels();
  };

  const handleReclassify = () => {
    if (!selectedAccount) return;
    actions.onReclassify(document.id, selectedAccount, (selectedDocType || document.documentType) as DocumentType);
    resetPanels();
  };

  const handleArchive = () => {
    actions.onArchive(document.id);
    resetPanels();
  };

  const handleDelete = () => {
    actions.onDelete(document.id);
    resetPanels();
    onClose();
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    actions.onAddNote(document.id, noteText);
    setNoteText("");
    setShowNote(false);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); resetPanels(); } }}>
      <SheetContent className="w-full max-w-lg overflow-y-auto border-l bg-card p-0 sm:max-w-xl">
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 border-b bg-card px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="rounded-md bg-muted p-2">
                <FileIcon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="truncate text-base font-semibold text-foreground">
                  {document.fileName}
                </SheetTitle>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={document.classificationStatus} />
                  <StatusBadge status={document.reconciliationStatus} />
                </div>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-0 divide-y">
          {/* File preview */}
          <div className="bg-muted/30">
            {!previewError && thumbnailUrl ? (
              <div className="relative">
                <img
                  src={thumbnailUrl}
                  alt={document.fileName}
                  className="w-full max-h-[300px] object-contain"
                  onError={() => setPreviewError(true)}
                />
                {previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 rounded-md bg-background/80 px-2 py-1 text-xs font-medium text-foreground shadow hover:bg-background transition-colors"
                  >
                    <Eye className="mr-1 inline-block h-3 w-3" /> Abrir original
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20 px-5">
                <div className="text-center">
                  <FileIcon className="mx-auto h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">Pré-visualização indisponível</p>
                </div>
              </div>
            )}
          </div>

          {/* Extraction confidence banner */}
          <div className={cn("flex items-center gap-3 px-5 py-3", isLowConf ? "bg-tim-danger/5 border-l-4 border-l-tim-danger" : "bg-tim-success/5 border-l-4 border-l-tim-success")}>
            {isLowConf ? (
              <AlertTriangle className="h-5 w-5 text-tim-danger" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-tim-success" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {isLowConf ? "Extração com baixa confiança" : "Dados extraídos corretamente"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isLowConf ? "Reveja os campos abaixo e corrija o que for necessário" : "Confirme e aprove o documento"}
              </p>
            </div>
          </div>

          {/* Extracted fields — with confirm action */}
          {document.extractedFields && document.extractedFields.length > 0 && (
            <div className="px-5 py-4">
              <SectionTitle>Campos Extraídos</SectionTitle>
              <div className="mt-3 space-y-2">
                {document.extractedFields.map((field, i) => (
                  <ExtractedFieldRow
                    key={i}
                    field={field}
                    onConfirm={() => actions.onConfirmField(document.id, i)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Entity info */}
          <div className="px-5 py-4">
            <SectionTitle>Informação da Entidade</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <InfoItem label={document.supplier ? "Fornecedor" : "Cliente"} value={document.supplier || document.customer || "—"} />
              <InfoItem label="NIF" value={document.nif || "—"} mono help="NIF" />
              <InfoItem label="Tipo" value={documentTypeLabels[document.documentType]} />
              <InfoItem label="Data" value={document.date || "—"} />
            </div>
          </div>

          {/* Financials */}
          <div className="px-5 py-4">
            <SectionTitle>Valores</SectionTitle>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <InfoItem label="Total" value={document.total != null ? `€${Math.abs(document.total).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}` : "—"} large />
              <InfoItem label="IVA" value={document.vat != null ? `€${Math.abs(document.vat).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}` : "—"} large help="IVA" />
              <InfoItem label="Base Tributável" value={document.total != null && document.vat != null ? `€${(Math.abs(document.total) - Math.abs(document.vat)).toLocaleString("pt-PT", { minimumFractionDigits: 2 })}` : "—"} large help="Base Tributável" />
            </div>
          </div>

          {/* Line items */}
          {document.lineItems && document.lineItems.length > 0 && (
            <div className="px-5 py-4">
              <SectionTitle>Linhas do Documento</SectionTitle>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Descrição</th>
                      <th className="pb-2 text-right font-medium">Qtd.</th>
                      <th className="pb-2 text-right font-medium">Preço</th>
                      <th className="pb-2 text-right font-medium">IVA</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {document.lineItems.map((item, i) => (
                      <tr key={i}>
                        <td className="py-1.5 pr-3 text-foreground">{item.description}</td>
                        <td className="py-1.5 text-right font-mono text-muted-foreground">{item.quantity}</td>
                        <td className="py-1.5 text-right font-mono text-muted-foreground">€{item.unitPrice.toFixed(2)}</td>
                        <td className="py-1.5 text-right font-mono text-muted-foreground">{item.vatRate}%</td>
                        <td className="py-1.5 text-right font-mono font-medium text-foreground">€{item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {document.notes && (
            <div className="px-5 py-4">
              <SectionTitle>Notas</SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{document.notes}</p>
            </div>
          )}

          {/* AI classification recommendation */}
          {!isApproved && !isArchived && suggestion && (
            <div className="px-5 py-4">
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium uppercase tracking-widest text-primary">Recomendação IA</span>
                </div>
                <p className="mt-2 text-xs text-foreground">
                  Classificar como <span className="font-semibold text-primary">{suggestion.account} — {suggestion.label}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.reason}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    suggestion.confidence >= 70 ? "bg-tim-success/10 text-tim-success" :
                    suggestion.confidence >= 50 ? "bg-tim-warning/10 text-tim-warning" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {suggestion.confidence}% confiança
                  </span>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {suggestion.source === "llm" ? "GPT" : suggestion.source === "rule" ? "Regra" : suggestion.source === "similar" ? "Histórico" : "Tipo"}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-tim-success/30 text-tim-success hover:bg-tim-success/10"
                    onClick={() => actions.onAcceptAiSuggestion(document.id)}
                  >
                    <Check className="mr-1 h-3 w-3" /> Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setShowReclassify(true); setShowReject(false); }}
                  >
                    <Eye className="mr-1 h-3 w-3" /> Rever
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => { setShowReject(true); setShowReclassify(false); }}
                  >
                    <X className="mr-1 h-3 w-3" /> Rejeitar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reclassify panel */}
          {showReclassify && (
            <div className="px-5 py-4 bg-secondary/20">
              <SectionTitle>Reclassificar Documento</SectionTitle>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Conta SNC</label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue placeholder="Selecionar conta…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SNC_ACCOUNTS.map((a) => (
                        <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tipo de documento</label>
                  <Select value={selectedDocType || document.documentType} onValueChange={(v) => setSelectedDocType(v as DocumentType)}>
                    <SelectTrigger className="mt-1 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(documentTypeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" disabled={!selectedAccount} onClick={handleReclassify}>
                    <Tags className="mr-1 h-3 w-3" /> Aplicar classificação
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReclassify(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reject panel */}
          {showReject && (
            <div className="px-5 py-4 bg-tim-danger/[0.03]">
              <SectionTitle>Rejeitar Documento</SectionTitle>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Motivo da rejeição</label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex: Documento duplicado, valores incorretos…"
                    className="mt-1 min-h-[60px] text-xs resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-tim-danger/30 text-tim-danger hover:bg-tim-danger/10"
                    disabled={!rejectReason.trim()}
                    onClick={handleReject}
                  >
                    <ThumbsDown className="mr-1 h-3 w-3" /> Confirmar rejeição
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowReject(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Add note panel */}
          {showNote && (
            <div className="px-5 py-4 bg-secondary/20">
              <SectionTitle>Adicionar Nota</SectionTitle>
              <div className="mt-3 space-y-3">
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Escrever nota sobre este documento…"
                  className="min-h-[60px] text-xs resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" disabled={!noteText.trim()} onClick={handleAddNote}>
                    Guardar nota
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowNote(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="px-5 py-4 bg-tim-danger/[0.03]">
              <SectionTitle>Eliminar Documento</SectionTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                Tem a certeza que quer eliminar este documento? Esta ação não pode ser desfeita.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-tim-danger/30 text-tim-danger hover:bg-tim-danger/10"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-1 h-3 w-3" /> Confirmar eliminação
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowDeleteConfirm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Actions footer */}
          <div className="sticky bottom-0 flex items-center gap-2 border-t bg-card px-5 py-3">
            {!isApproved && !isArchived && (
              <Button size="sm" className="h-9 text-sm" onClick={handleApprove}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Aprovar
              </Button>
            )}
            {!isArchived && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-sm"
                onClick={() => { setShowReclassify(!showReclassify); setShowReject(false); setShowDeleteConfirm(false); }}
              >
                <Tags className="mr-1.5 h-4 w-4" />
                Reclassificar
              </Button>
            )}
            {!isArchived && !showReject && (
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-sm text-tim-danger border-tim-danger/20 hover:bg-tim-danger/5"
                onClick={() => { setShowReject(!showReject); setShowReclassify(false); setShowDeleteConfirm(false); }}
              >
                <ThumbsDown className="mr-1.5 h-4 w-4" />
                Rejeitar
              </Button>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-sm text-muted-foreground"
                onClick={() => setShowNote(!showNote)}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Nota
              </Button>
              {!isArchived && (
                <Button size="sm" variant="ghost" className="h-9 text-sm text-muted-foreground" onClick={handleArchive}>
                  <Archive className="mr-1.5 h-4 w-4" />
                  Arquivar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-sm text-muted-foreground"
                onClick={() => { actions.onReprocess(document.id); onClose(); resetPanels(); }}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Reprocessar
              </Button>
              {isArchived && (
                <Button size="sm" variant="ghost" className="h-9 text-sm text-muted-foreground" onClick={handleApprove}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Restaurar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-sm text-tim-danger"
                onClick={() => { setShowDeleteConfirm(!showDeleteConfirm); setShowReclassify(false); setShowReject(false); }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>;
}

function InfoItem({ label, value, mono, large, help }: { label: string; value: string; mono?: boolean; large?: boolean; help?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {help ? <HelpTooltip term={help}>{label}</HelpTooltip> : label}
      </p>
      <p className={cn("mt-0.5 text-foreground", large ? "text-base font-semibold" : "text-sm", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function ExtractedFieldRow({ field, onConfirm }: { field: ExtractedField; onConfirm: () => void }) {
  const isLow = field.confidence < 60;
  const isMid = field.confidence >= 60 && field.confidence < 80;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5",
        field.confirmed ? "bg-muted/30" : isLow ? "bg-tim-danger/5 border-l-2 border-l-tim-danger" : isMid ? "bg-tim-warning/5 border-l-2 border-l-tim-warning" : "bg-tim-success/5 border-l-2 border-l-tim-success"
      )}
    >
      {field.confirmed ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-tim-success" />
      ) : isLow ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-tim-danger" />
      ) : (
        <Eye className="h-4 w-4 shrink-0 text-tim-warning" />
      )}

      <div className="flex-1 min-w-0 grid grid-cols-3 gap-2 items-center">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{field.label}</span>
        <div className="text-sm">
          <span className="text-muted-foreground line-through mr-1.5">{field.sourceValue}</span>
        </div>
        <span className={cn("text-sm font-medium", field.confirmed ? "text-foreground" : "text-primary")}>
          {field.interpretedValue}
          {!field.confirmed && <span className="ml-1 text-xs text-primary/60">(sugerido)</span>}
        </span>
      </div>

      {!field.confirmed && (
        <button
          onClick={onConfirm}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Confirmar campo"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
