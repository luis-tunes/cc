import { useState, useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHint } from "@/components/shared/PageHint";
import { ErrorState } from "@/components/shared/ErrorState";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, BookOpen, Loader2, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useJournalEntries,
  useJournalEntry,
  useCreateJournalEntry,
  useAccountingJournals,
  useAccounts,
  useFiscalPeriods,
  type JournalEntry,
} from "@/hooks/use-accounting";
import type { JournalEntryCreate, JournalEntryLineIn } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";

function fmt(v: string) {
  const n = parseFloat(v);
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  posted: "bg-tim-success/15 text-tim-success border-tim-success/30",
  cancelled: "bg-tim-danger/15 text-tim-danger border-tim-danger/30",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  posted: "Lançado",
  cancelled: "Anulado",
};

function ViewEntryDialog({ entryId, onClose }: { entryId: number | null; onClose: () => void }) {
  const { data: entry, isLoading } = useJournalEntry(entryId);

  if (!entryId) return null;

  return (
    <Dialog open={entryId !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lançamento #{entryId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : entry ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Data:</span> {entry.entry_date}</div>
              <div><span className="text-muted-foreground">Diário:</span> {entry.journal_code} — {entry.journal_name}</div>
              <div><span className="text-muted-foreground">Referência:</span> {entry.reference || "—"}</div>
              <div><span className="text-muted-foreground">Estado:</span> <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[entry.status])}>{STATUS_LABELS[entry.status] ?? entry.status}</Badge></div>
              {entry.description && <div className="col-span-2"><span className="text-muted-foreground">Descrição:</span> {entry.description}</div>}
            </div>
            {entry.lines && entry.lines.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entry.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm">{line.account_code} — {line.account_name}</TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(line.debit) > 0 ? fmt(line.debit) : ""}</TableCell>
                      <TableCell className="text-right font-mono">{parseFloat(line.credit) > 0 ? fmt(line.credit) : ""}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{line.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Lançamento não encontrado.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateEntryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateJournalEntry();
  const { data: journals } = useAccountingJournals();
  const { data: accounts } = useAccounts();
  const { data: periods } = useFiscalPeriods();

  const [journalId, setJournalId] = useState<string>("");
  const [periodId, setPeriodId] = useState<string>("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalEntryLineIn[]>([
    { account_code: "", debit: "0", credit: "0", description: "" },
    { account_code: "", debit: "0", credit: "0", description: "" },
  ]);

  function addLine() {
    setLines([...lines, { account_code: "", debit: "0", credit: "0", description: "" }]);
  }

  function updateLine(i: number, field: keyof JournalEntryLineIn, value: string) {
    const updated = [...lines];
    updated[i] = { ...updated[i], [field]: value };
    setLines(updated);
  }

  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, idx) => idx !== i));
  }

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + parseFloat(l.debit || "0"), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + parseFloat(l.credit || "0"), 0), [lines]);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!journalId) return;
    const data: JournalEntryCreate = {
      journal_id: parseInt(journalId),
      entry_date: entryDate,
      lines: lines.filter((l) => l.account_code),
      reference,
      description,
      period_id: periodId ? parseInt(periodId) : undefined,
    };
    create.mutate(data, {
      onSuccess: () => {
        onClose();
        setLines([
          { account_code: "", debit: "0", credit: "0", description: "" },
          { account_code: "", debit: "0", credit: "0", description: "" },
        ]);
        setReference("");
        setDescription("");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Diário</Label>
              <Select value={journalId} onValueChange={setJournalId}>
                <SelectTrigger><SelectValue placeholder="Selecionar diário" /></SelectTrigger>
                <SelectContent>
                  {(journals ?? []).map((j) => (
                    <SelectItem key={j.id} value={String(j.id)}>{j.code} — {j.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
            </div>
            <div>
              <Label>Período Fiscal</Label>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {(periods ?? []).filter((p) => p.status === "open").map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referência</Label>
              <Input placeholder="FT 2024/001" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input placeholder="Compra de mercadorias" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Linhas</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-3 w-3 mr-1" /> Linha
              </Button>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead className="w-[130px]">Débito</TableHead>
                    <TableHead className="w-[130px]">Crédito</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={line.account_code} onValueChange={(v) => updateLine(i, "account_code", v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Conta" /></SelectTrigger>
                          <SelectContent>
                            {(accounts ?? []).map((a) => (
                              <SelectItem key={a.code} value={a.code}>
                                <span className="font-mono">{a.code}</span> {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min="0" className="h-8 text-xs text-right font-mono" value={line.debit} onChange={(e) => updateLine(i, "debit", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" min="0" className="h-8 text-xs text-right font-mono" value={line.credit} onChange={(e) => updateLine(i, "credit", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-xs" value={line.description ?? ""} onChange={(e) => updateLine(i, "description", e.target.value)} />
                      </TableCell>
                      <TableCell>
                        {lines.length > 2 && (
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeLine(i)}>×</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right font-mono">{fmt(String(totalDebit))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(String(totalCredit))}</TableCell>
                    <TableCell colSpan={2}>
                      {balanced ? (
                        <Badge variant="outline" className="bg-tim-success/15 text-tim-success border-tim-success/30 text-xs">Balanceado</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-tim-danger/15 text-tim-danger border-tim-danger/30 text-xs">
                          Diferença: {fmt(String(Math.abs(totalDebit - totalCredit)))}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !balanced || !journalId}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Lançamento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PAGE_SIZE = 50;

export default function JournalEntries() {
  const [filterJournal, setFilterJournal] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewId, setViewId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(0);

  const { data: journals } = useAccountingJournals();
  const { data: entries, isLoading, error } = useJournalEntries({
    journal_id: filterJournal === "all" ? undefined : parseInt(filterJournal),
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const isMobile = useIsMobile();

  if (error) return <PageContainer title="Lançamentos"><ErrorState title="Erro ao carregar lançamentos" /></PageContainer>;

  return (
    <PageContainer
      title="Lançamentos"
      subtitle="Diário de lançamentos contabilísticos"
      actions={
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Lançamento
        </Button>
      }
    >
      <PageHint id="journal-entries">
        Cada lançamento regista um movimento contabilístico com linhas de débito e crédito. O total de débitos tem de igualar os créditos para o lançamento ficar equilibrado.
      </PageHint>
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <Select value={filterJournal} onValueChange={(v) => { setFilterJournal(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Diário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os diários</SelectItem>
            {(journals ?? []).map((j) => (
              <SelectItem key={j.id} value={String(j.id)}>{j.code} — {j.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-[160px]" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} placeholder="De" />
        <Input type="date" className="w-[160px]" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} placeholder="Até" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : (!entries || entries.length === 0) ? (
        <EmptyState
          icon={BookOpen}
          title="Sem lançamentos"
          description="Crie lançamentos manuais ou gere-os automaticamente a partir de documentos e movimentos bancários."
          actionLabel="Novo Lançamento"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">#</TableHead>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead className="w-[80px]">Diário</TableHead>
                  {!isMobile && <TableHead>Referência</TableHead>}
                  <TableHead>Descrição</TableHead>
                  {!isMobile && <TableHead className="w-[100px]">Estado</TableHead>}
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewId(entry.id)}>
                    <TableCell className="font-mono text-sm">{entry.id}</TableCell>
                    <TableCell className="text-sm">{entry.entry_date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{entry.journal_code}</Badge>
                    </TableCell>
                    {!isMobile && <TableCell className="text-sm text-muted-foreground">{entry.reference || "—"}</TableCell>}
                    <TableCell className="text-sm max-w-[300px] truncate">{entry.description || "—"}</TableCell>
                    {!isMobile && (
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[entry.status])}>
                          {STATUS_LABELS[entry.status] ?? entry.status}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setViewId(entry.id); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Página {page + 1} · {entries.length} resultados
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={entries.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>
                Seguinte <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      <ViewEntryDialog entryId={viewId} onClose={() => setViewId(null)} />
      <CreateEntryDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </PageContainer>
  );
}
