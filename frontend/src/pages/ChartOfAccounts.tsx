import { useState } from "react";
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
import { Plus, BookOpen, Search, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useAccounts,
  useSeedAccounting,
  useCreateAccount,
  usePatchAccount,
  type Account,
} from "@/hooks/use-accounting";
import { useIsMobile } from "@/hooks/use-mobile";

const ACCOUNT_TYPES = [
  { value: "asset", label: "Ativo" },
  { value: "liability", label: "Passivo" },
  { value: "equity", label: "Capital Próprio" },
  { value: "revenue", label: "Rendimentos" },
  { value: "expense", label: "Gastos" },
];

const TYPE_LABELS: Record<string, string> = {
  asset: "Ativo",
  liability: "Passivo",
  equity: "Capital Próprio",
  revenue: "Rendimentos",
  expense: "Gastos",
};

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-tim-info/15 text-tim-info border-tim-info/30",
  liability: "bg-tim-danger/15 text-tim-danger border-tim-danger/30",
  equity: "bg-primary/15 text-primary border-primary/30",
  revenue: "bg-tim-success/15 text-tim-success border-tim-success/30",
  expense: "bg-tim-warning/15 text-tim-warning border-tim-warning/30",
};

function AddAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAccount();
  const [form, setForm] = useState({ code: "", name: "", type: "expense", parent_code: "" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(form, { onSuccess: () => { onClose(); setForm({ code: "", name: "", type: "expense", parent_code: "" }); } });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Conta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código</Label>
              <Input placeholder="6211" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Nome</Label>
            <Input placeholder="Subcontratos" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Conta-Pai (opcional)</Label>
            <Input placeholder="62" value={form.parent_code} onChange={(e) => setForm({ ...form, parent_code: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ChartOfAccounts() {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: accounts, isLoading, error } = useAccounts(
    filterType === "all" ? undefined : filterType,
    true,
  );
  const seed = useSeedAccounting();
  const patch = usePatchAccount();
  const isMobile = useIsMobile();

  if (error) return <PageContainer title="Plano de Contas"><ErrorState title="Erro ao carregar contas" /></PageContainer>;

  const filtered = (accounts ?? []).filter((a) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q);
  });

  // Group by class (first digit of code)
  const classes = new Map<string, Account[]>();
  for (const a of filtered) {
    const cls = a.code.charAt(0);
    if (!classes.has(cls)) classes.set(cls, []);
    classes.get(cls)!.push(a);
  }

  const CLASS_NAMES: Record<string, string> = {
    "1": "Meios Financeiros Líquidos",
    "2": "Contas a Receber e a Pagar",
    "3": "Inventários e Ativos Biológicos",
    "4": "Investimentos",
    "5": "Capital, Reservas e Resultados Transitados",
    "6": "Gastos",
    "7": "Rendimentos",
    "8": "Resultados",
  };

  return (
    <PageContainer
      title="Plano de Contas"
      subtitle="Sistema de Normalização Contabilística (SNC)"
      actions={
        <div className="flex gap-2">
          {(!accounts || accounts.length === 0) && (
            <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
              {seed.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Inicializar SNC
            </Button>
          )}
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conta
          </Button>
        </div>
      }
    >
      <PageHint id="chart-of-accounts">
        O Plano de Contas é a estrutura da sua contabilidade. Clique em «Inicializar SNC» para começar com o modelo padrão português (classes 1 a 8).
      </PageHint>
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por código ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {ACCOUNT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : (!accounts || accounts.length === 0) ? (
        <EmptyState
          icon={BookOpen}
          title="Plano de contas vazio"
          description="Inicialize o plano SNC para começar com as contas padrão portuguesas."
          actionLabel="Inicializar SNC"
          onAction={() => seed.mutate()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhuma conta encontrada"
          description="Ajuste os filtros de pesquisa."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(classes.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cls, accs]) => (
              <div key={cls} className="rounded-lg border bg-card">
                <div className="border-b bg-muted/50 px-4 py-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Classe {cls} — {CLASS_NAMES[cls] ?? "Outro"}
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Código</TableHead>
                      <TableHead>Nome</TableHead>
                      {!isMobile && <TableHead className="w-[140px]">Tipo</TableHead>}
                      {!isMobile && <TableHead className="w-[100px]">Pai</TableHead>}
                      <TableHead className="w-[80px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accs.sort((a, b) => a.code.localeCompare(b.code)).map((account) => (
                      <TableRow key={account.id} className={cn(!account.active && "opacity-50")}>
                        <TableCell className="font-mono text-sm font-medium">{account.code}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        {!isMobile && (
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs", TYPE_COLORS[account.type])}>
                              {TYPE_LABELS[account.type] ?? account.type}
                            </Badge>
                          </TableCell>
                        )}
                        {!isMobile && (
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {account.parent_code || "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              patch.mutate({ id: account.id, data: { active: !account.active } })
                            }
                          >
                            {account.active ? "Desativar" : "Ativar"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
        </div>
      )}

      <AddAccountDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </PageContainer>
  );
}
