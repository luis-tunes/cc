import { useState, useMemo, useEffect } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FileText,
  Search,
  Trash2,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Send,
  CreditCard,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useInvoices,
  useInvoice,
  useInvoiceSeries,
  useCreateInvoiceSeries,
  useCreateInvoice,
  useFinalizeInvoice,
  useVoidInvoice,
  useDeleteInvoice,
  useInvoicePayments,
  useCreatePayment,
  useDeletePayment,
  type Invoice,
} from "@/hooks/use-invoices";
import { useCustomers } from "@/hooks/use-customers";
import type { InvoiceLineIn } from "@/lib/api";
import { invoiceHtmlUrl } from "@/lib/api";

const DOC_TYPES: Record<string, string> = {
  FT: "Fatura",
  FS: "Fatura Simplificada",
  FR: "Fatura-Recibo",
  NC: "Nota de Crédito",
  ND: "Nota de Débito",
  RC: "Recibo",
  OR: "Orçamento",
  PP: "Fatura Pro Forma",
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  emitida: "Emitida",
  anulada: "Anulada",
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  emitida: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  anulada: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const VAT_RATES = ["23", "13", "6", "0"];

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);

// ── Series Dialog ──────────────────────────────────────────────────

function SeriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateInvoiceSeries();
  const [code, setCode] = useState("");
  const [docType, setDocType] = useState("FT");
  const [atcud, setAtcud] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    create.mutate(
      { series_code: code.trim(), document_type: docType, atcud_validation_code: atcud },
      { onSuccess: () => { setCode(""); setAtcud(""); onClose(); } },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Série</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código da Série</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FT2024"
                required
              />
            </div>
            <div>
              <Label>Tipo de Documento</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{k} — {v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Código de Validação ATCUD (opcional)</Label>
            <Input
              value={atcud}
              onChange={(e) => setAtcud(e.target.value)}
              placeholder="Código AT (se certificado)"
            />
          </div>
          <Button type="submit" disabled={create.isPending} className="w-full">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Série
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Invoice Line Editor ────────────────────────────────────────────

interface LineRow {
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  vat_rate: string;
  snc_account: string;
}

const emptyLine = (): LineRow => ({
  description: "",
  quantity: "1",
  unit_price: "0",
  discount_pct: "0",
  vat_rate: "23",
  snc_account: "",
});

function computeLineTotal(ln: LineRow) {
  const qty = parseFloat(ln.quantity) || 0;
  const price = parseFloat(ln.unit_price) || 0;
  const disc = parseFloat(ln.discount_pct) || 0;
  const vat = parseFloat(ln.vat_rate) || 0;
  const gross = qty * price;
  const discountAmt = gross * disc / 100;
  const subtotal = gross - discountAmt;
  const vatAmt = subtotal * vat / 100;
  return { subtotal, vatAmt, total: subtotal + vatAmt };
}

// ── Create Invoice Dialog ──────────────────────────────────────────

function CreateInvoiceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: series } = useInvoiceSeries();
  const { data: customers } = useCustomers();
  const create = useCreateInvoice();

  const [seriesId, setSeriesId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerNif, setCustomerNif] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [whPct, setWhPct] = useState("0");
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);

  // Auto-fill customer name/NIF when selecting from dropdown
  useEffect(() => {
    if (customerId && customers) {
      const c = customers.find((cu) => cu.id === parseInt(customerId));
      if (c) {
        setCustomerName(c.name);
        setCustomerNif(c.nif || "");
      }
    }
  }, [customerId, customers]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let vatTotal = 0;
    for (const ln of lines) {
      const t = computeLineTotal(ln);
      subtotal += t.subtotal;
      vatTotal += t.vatAmt;
    }
    const total = subtotal + vatTotal;
    const wh = subtotal * (parseFloat(whPct) || 0) / 100;
    return { subtotal, vatTotal, total, wh, net: total - wh };
  }, [lines, whPct]);

  function updateLine(idx: number, field: keyof LineRow, value: string) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!seriesId) return;
    const apiLines: InvoiceLineIn[] = lines.map((ln) => ({
      description: ln.description,
      quantity: parseFloat(ln.quantity) || 0,
      unit_price: parseFloat(ln.unit_price) || 0,
      discount_pct: parseFloat(ln.discount_pct) || 0,
      vat_rate: parseFloat(ln.vat_rate) || 23,
      snc_account: ln.snc_account,
    }));
    create.mutate(
      {
        series_id: parseInt(seriesId),
        customer_id: customerId ? parseInt(customerId) : undefined,
        customer_name: customerName,
        customer_nif: customerNif,
        issue_date: issueDate,
        due_date: dueDate || undefined,
        notes,
        withholding_tax_pct: parseFloat(whPct) || 0,
        lines: apiLines,
      },
      {
        onSuccess: () => {
          setLines([emptyLine()]);
          setNotes("");
          setCustomerId("");
          setCustomerName("");
          setCustomerNif("");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Fatura</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>Série *</Label>
              <Select value={seriesId} onValueChange={setSeriesId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {series?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.series_code} ({s.document_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">— Sem cliente —</SelectItem>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} {c.nif && `(${c.nif})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Emissão *</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </div>
            <div>
              <Label>Data de Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome do Cliente</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div>
              <Label>NIF do Cliente</Label>
              <Input value={customerNif} onChange={(e) => setCustomerNif(e.target.value)} />
            </div>
          </div>

          {/* Lines */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">Linhas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar Linha
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((ln, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    {idx === 0 && <Label className="text-xs">Descrição</Label>}
                    <Input
                      value={ln.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      placeholder="Descrição do item"
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <Label className="text-xs">Qtd</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={ln.quantity}
                      onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <Label className="text-xs">Preço Unit.</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={ln.unit_price}
                      onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <Label className="text-xs">Desc.%</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={ln.discount_pct}
                      onChange={(e) => updateLine(idx, "discount_pct", e.target.value)}
                    />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <Label className="text-xs">IVA%</Label>}
                    <Select value={ln.vat_rate} onValueChange={(v) => updateLine(idx, "vat_rate", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VAT_RATES.map((r) => (
                          <SelectItem key={r} value={r}>{r}%</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium pt-1">
                    {fmt(computeLineTotal(ln).total)}
                  </div>
                  <div className="col-span-1">
                    {lines.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeLine(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Retenção na Fonte (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={whPct}
                  onChange={(e) => setWhPct(e.target.value)}
                />
              </div>
              <div className="space-y-1 text-right text-sm">
                <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">{fmt(totals.subtotal)}</span></div>
                <div className="flex justify-between"><span>IVA:</span> <span className="font-medium">{fmt(totals.vatTotal)}</span></div>
                <div className="flex justify-between"><span>Total:</span> <span className="font-bold">{fmt(totals.total)}</span></div>
                {totals.wh > 0 && (
                  <>
                    <div className="flex justify-between text-muted-foreground"><span>Retenção:</span> <span>-{fmt(totals.wh)}</span></div>
                    <div className="flex justify-between border-t pt-1"><span>Valor a Receber:</span> <span className="font-bold">{fmt(totals.net)}</span></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notas / Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" disabled={create.isPending || !seriesId} className="w-full">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Fatura (Rascunho)
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── View Invoice Dialog ────────────────────────────────────────────

function ViewInvoiceDialog({
  invoiceId,
  open,
  onClose,
}: {
  invoiceId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const { data: inv } = useInvoice(invoiceId);
  const finalize = useFinalizeInvoice();
  const voidMut = useVoidInvoice();
  const { data: payments } = useInvoicePayments(invoiceId);
  const createPayment = useCreatePayment();
  const removePayment = useDeletePayment();
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("");

  if (!inv) return null;

  const displayNum = `${inv.series_code} ${new Date(inv.issue_date).getFullYear()}/${inv.number}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {displayNum}
            <Badge className={cn("ml-2", STATUS_COLORS[inv.status])}>
              {STATUS_LABELS[inv.status] ?? inv.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Cliente:</span>{" "}
              <span className="font-medium">{inv.customer_name || "—"}</span>
              {inv.customer_nif && <span className="text-muted-foreground ml-1">({inv.customer_nif})</span>}
            </div>
            <div>
              <span className="text-muted-foreground">Data:</span>{" "}
              <span className="font-medium">{new Date(inv.issue_date).toLocaleDateString("pt-PT")}</span>
              {inv.due_date && (
                <span className="text-muted-foreground ml-2">
                  Venc: {new Date(inv.due_date).toLocaleDateString("pt-PT")}
                </span>
              )}
            </div>
            {inv.atcud && (
              <div>
                <span className="text-muted-foreground">ATCUD:</span>{" "}
                <span className="font-mono text-xs">{inv.atcud}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Tipo:</span>{" "}
              <span>{DOC_TYPES[inv.document_type] ?? inv.document_type}</span>
            </div>
          </div>

          {/* Lines */}
          {inv.lines && inv.lines.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Desc.</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inv.lines.map((ln) => (
                  <TableRow key={ln.id}>
                    <TableCell>{ln.line_number}</TableCell>
                    <TableCell>{ln.description}</TableCell>
                    <TableCell className="text-right">{ln.quantity}</TableCell>
                    <TableCell className="text-right">{fmt(ln.unit_price)}</TableCell>
                    <TableCell className="text-right">{ln.discount_pct}%</TableCell>
                    <TableCell className="text-right">{ln.vat_rate}%</TableCell>
                    <TableCell className="text-right font-medium">{fmt(ln.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Totals */}
          <div className="text-right text-sm space-y-1 border-t pt-3">
            <div className="flex justify-end gap-8"><span className="text-muted-foreground">Subtotal:</span> <span className="w-28 text-right">{fmt(inv.subtotal)}</span></div>
            <div className="flex justify-end gap-8"><span className="text-muted-foreground">IVA:</span> <span className="w-28 text-right">{fmt(inv.vat_total)}</span></div>
            <div className="flex justify-end gap-8 font-bold"><span>Total:</span> <span className="w-28 text-right">{fmt(inv.total)}</span></div>
            {inv.withholding_tax > 0 && (
              <>
                <div className="flex justify-end gap-8 text-muted-foreground"><span>Retenção:</span> <span className="w-28 text-right">-{fmt(inv.withholding_tax)}</span></div>
                <div className="flex justify-end gap-8 font-bold border-t pt-1"><span>Valor a Receber:</span> <span className="w-28 text-right">{fmt(inv.net_total)}</span></div>
              </>
            )}
          </div>

          {inv.notes && (
            <div className="text-sm">
              <span className="text-muted-foreground">Notas:</span> {inv.notes}
            </div>
          )}

          {/* Payments section — only for finalized invoices */}
          {inv.status === "emitida" && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold flex items-center gap-1">
                  <CreditCard className="h-4 w-4" /> Pagamentos
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowPayForm(!showPayForm); setPayAmount(""); }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Registar
                </Button>
              </div>

              {showPayForm && (
                <div className="flex gap-2 items-end mb-3 p-2 bg-muted/50 rounded">
                  <div className="flex-1">
                    <Label className="text-xs">Valor (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Método</Label>
                    <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="Transferência" />
                  </div>
                  <Button
                    size="sm"
                    disabled={!payAmount || createPayment.isPending}
                    onClick={() => {
                      createPayment.mutate(
                        { invoiceId: inv.id, data: { amount: payAmount, payment_date: payDate, method: payMethod } },
                        { onSuccess: () => { setShowPayForm(false); setPayAmount(""); setPayMethod(""); } },
                      );
                    }}
                  >
                    {createPayment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                  </Button>
                </div>
              )}

              {payments && payments.length > 0 ? (
                <div className="text-sm space-y-1">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
                      <span>
                        {new Date(p.payment_date).toLocaleDateString("pt-PT")}
                        {p.method && <span className="text-muted-foreground ml-1">({p.method})</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{fmt(p.amount)}</span>
                        <button
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removePayment.mutate({ invoiceId: inv.id, paymentId: p.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum pagamento registado.</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {inv.status === "rascunho" && (
              <Button
                onClick={() => finalize.mutate(inv.id, { onSuccess: onClose })}
                disabled={finalize.isPending}
              >
                {finalize.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Emitir Fatura
              </Button>
            )}
            {inv.status === "emitida" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => window.open(invoiceHtmlUrl(inv.id), "_blank")}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir / PDF
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => voidMut.mutate(inv.id, { onSuccess: onClose })}
                  disabled={voidMut.isPending}
                >
                  {voidMut.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Anular
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showSeries, setShowSeries] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: series } = useInvoiceSeries();
  const { data: invoices, isLoading, error } = useInvoices({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });
  const deleteMut = useDeleteInvoice();

  if (error) return <ErrorState title="Erro ao carregar faturas" />;

  const hasSeries = series && series.length > 0;

  return (
    <PageContainer title="Faturas" subtitle="Emissão e gestão de faturas">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar faturas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="emitida">Emitida</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowSeries(true)}>
            <Plus className="mr-1 h-4 w-4" /> Série
          </Button>
          <Button onClick={() => setShowCreate(true)} disabled={!hasSeries}>
            <Plus className="mr-1 h-4 w-4" /> Nova Fatura
          </Button>
        </div>

        {/* Empty state */}
        {!isLoading && (!invoices || invoices.length === 0) && (
          <EmptyState
            icon={FileText}
            title={hasSeries ? "Sem faturas" : "Crie uma série primeiro"}
            description={
              hasSeries
                ? "Crie a sua primeira fatura para começar a faturar."
                : "É necessário criar uma série de faturação antes de emitir faturas."
            }
            actionLabel={!hasSeries ? "Criar Série" : undefined}
            onAction={!hasSeries ? () => setShowSeries(true) : undefined}
          />
        )}

        {/* Table */}
        {invoices && invoices.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>NIF</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewId(inv.id)}
                  >
                    <TableCell className="font-mono text-sm">
                      {inv.series_code} {new Date(inv.issue_date).getFullYear()}/{inv.number}
                    </TableCell>
                    <TableCell>{new Date(inv.issue_date).toLocaleDateString("pt-PT")}</TableCell>
                    <TableCell>{inv.customer_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.customer_nif || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(inv.total)}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", STATUS_COLORS[inv.status])}>
                        {STATUS_LABELS[inv.status] ?? inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" onClick={() => setViewId(inv.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {inv.status === "rascunho" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(inv.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <SeriesDialog open={showSeries} onClose={() => setShowSeries(false)} />
      <CreateInvoiceDialog open={showCreate} onClose={() => setShowCreate(false)} />
      <ViewInvoiceDialog
        invoiceId={viewId}
        open={viewId !== null}
        onClose={() => setViewId(null)}
      />
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(v) => !v && setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteMut.mutate(deleteId);
          setDeleteId(null);
        }}
        title="Eliminar fatura?"
        description="Esta ação eliminará permanentemente o rascunho da fatura."
      />
    </PageContainer>
  );
}
