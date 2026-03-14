import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Tags, Zap, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface ClassificationRule {
  id: string;
  field: "supplier_nif" | "description" | "amount_gte" | "amount_lte" | "type";
  operator: "equals" | "contains" | "starts_with" | "gte" | "lte";
  value: string;
  account: string;
  label: string;
  active: boolean;
}

const FIELD_LABELS: Record<ClassificationRule["field"], string> = {
  supplier_nif: "NIF Fornecedor",
  description: "Descrição",
  amount_gte: "Montante ≥",
  amount_lte: "Montante ≤",
  type: "Tipo doc.",
};

const OPERATOR_LABELS: Record<ClassificationRule["operator"], string> = {
  equals: "é",
  contains: "contém",
  starts_with: "começa com",
  gte: "≥",
  lte: "≤",
};

const SNC_ACCOUNTS = [
  { code: "21", label: "Fornecedores" },
  { code: "22", label: "Clientes" },
  { code: "31", label: "Compras" },
  { code: "62", label: "FSE — Fornecimentos e Serviços Externos" },
  { code: "63", label: "Gastos com Pessoal" },
  { code: "64", label: "Gastos de Depreciação" },
  { code: "71", label: "Vendas" },
  { code: "72", label: "Prestações de Serviços" },
  { code: "24311", label: "IVA Dedutível" },
  { code: "24321", label: "IVA Liquidado" },
];

function RuleRow({ rule, onDelete, onToggle }: { rule: ClassificationRule; onDelete: () => void; onToggle: () => void }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors", rule.active ? "border-border bg-card" : "border-border/50 bg-muted/20 opacity-60")}>
      <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="outline" className="text-[10px]">{FIELD_LABELS[rule.field]}</Badge>
          <span className="text-muted-foreground">{OPERATOR_LABELS[rule.operator]}</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{rule.value}</code>
          <span className="text-muted-foreground">→</span>
          <Badge className="bg-primary/20 text-primary text-[10px]">{rule.account} — {SNC_ACCOUNTS.find(a => a.code === rule.account)?.label ?? rule.label}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={cn("h-5 w-9 rounded-full transition-colors", rule.active ? "bg-primary" : "bg-muted")}
          title={rule.active ? "Desativar" : "Ativar"}
        >
          <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition-transform mx-0.5", rule.active ? "translate-x-4" : "translate-x-0")} />
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-tim-danger transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Classifications() {
  const [rules, setRules] = useState<ClassificationRule[]>([
    { id: "1", field: "type", operator: "equals", value: "fatura", account: "21", label: "Fornecedores", active: true },
    { id: "2", field: "type", operator: "equals", value: "fatura-fornecedor", account: "62", label: "FSE", active: true },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState<Partial<ClassificationRule>>({
    field: "supplier_nif", operator: "equals", value: "", account: "62", active: true,
  });

  const addRule = () => {
    if (!newRule.value || !newRule.account) {
      toast.error("Preencha todos os campos");
      return;
    }
    const rule: ClassificationRule = {
      id: Date.now().toString(),
      field: newRule.field ?? "supplier_nif",
      operator: newRule.operator ?? "equals",
      value: newRule.value,
      account: newRule.account,
      label: SNC_ACCOUNTS.find(a => a.code === newRule.account)?.label ?? newRule.account,
      active: true,
    };
    setRules((prev) => [...prev, rule]);
    setDialogOpen(false);
    setNewRule({ field: "supplier_nif", operator: "equals", value: "", account: "62", active: true });
    toast.success("Regra adicionada", { description: "A regra será aplicada a novos documentos importados." });
  };

  return (
    <PageContainer
      title="Classificações"
      subtitle="Regras automáticas de classificação SNC por campo e valor"
      actions={
        <Button size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Regra
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-tim-info/20 bg-tim-info/5 px-4 py-3">
        <Zap className="h-4 w-4 shrink-0 text-tim-info" />
        <p className="text-xs text-muted-foreground">
          As regras são aplicadas por ordem. A primeira regra que corresponder ao documento é usada para classificação automática.
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
          <Tags className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Sem regras de classificação</p>
          <p className="mt-1 text-xs text-muted-foreground">Crie regras para classificar documentos automaticamente ao importar</p>
          <Button size="sm" variant="outline" className="mt-4 h-8 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Criar primeira regra
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onDelete={() => {
                setRules((prev) => prev.filter((r) => r.id !== rule.id));
                toast.success("Regra eliminada");
              }}
              onToggle={() => setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: !r.active } : r))}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Regra de Classificação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Campo</label>
                <Select value={newRule.field} onValueChange={(v) => setNewRule((p) => ({ ...p, field: v as ClassificationRule["field"] }))}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Operador</label>
                <Select value={newRule.operator} onValueChange={(v) => setNewRule((p) => ({ ...p, operator: v as ClassificationRule["operator"] }))}>
                  <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor</label>
              <Input className="mt-1 h-8 text-xs" placeholder="ex: 500000001" value={newRule.value} onChange={(e) => setNewRule((p) => ({ ...p, value: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Conta SNC</label>
              <Select value={newRule.account} onValueChange={(v) => setNewRule((p) => ({ ...p, account: v }))}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SNC_ACCOUNTS.map((a) => <SelectItem key={a.code} value={a.code} className="text-xs">{a.code} — {a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs" onClick={addRule}>Adicionar Regra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
