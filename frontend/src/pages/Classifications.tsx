import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Tags, Zap, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useClassificationRules, useCreateClassificationRule, useUpdateClassificationRule, useDeleteClassificationRule } from "@/hooks/use-classifications";
import type { ClassificationRule, ClassificationRuleCreate } from "@/lib/api";

const FIELD_LABELS: Record<string, string> = {
  supplier_nif: "NIF Fornecedor",
  description: "Descrição",
  amount_gte: "Montante ≥",
  amount_lte: "Montante ≤",
  type: "Tipo doc.",
};

const OPERATOR_LABELS: Record<string, string> = {
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
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <Badge variant="outline" className="text-xs">{FIELD_LABELS[rule.field] ?? rule.field}</Badge>
          <span className="text-muted-foreground">{OPERATOR_LABELS[rule.operator] ?? rule.operator}</span>
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{rule.value}</code>
          <span className="text-muted-foreground">→</span>
          <Badge className="bg-primary/20 text-primary text-xs">{rule.account} — {SNC_ACCOUNTS.find(a => a.code === rule.account)?.label ?? rule.label}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          className={cn("h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", rule.active ? "bg-primary" : "bg-muted")}
          role="switch"
          aria-checked={rule.active}
          title={rule.active ? "Desativar" : "Ativar"}
        >
          <span className={cn("block h-4 w-4 rounded-full bg-background shadow transition-transform mx-0.5", rule.active ? "translate-x-4" : "translate-x-0")} />
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-tim-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded" aria-label="Eliminar regra">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Classifications() {
  const { data: rules = [], isLoading, isError } = useClassificationRules();
  const createRule = useCreateClassificationRule();
  const updateRule = useUpdateClassificationRule();
  const deleteRule = useDeleteClassificationRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState<Partial<ClassificationRuleCreate>>({
    field: "supplier_nif", operator: "equals", value: "", account: "62",
  });

  const addRule = () => {
    if (!newRule.value || !newRule.account || !newRule.field || !newRule.operator) {
      toast.error("Preencha todos os campos");
      return;
    }
    createRule.mutate(
      {
        field: newRule.field,
        operator: newRule.operator,
        value: newRule.value,
        account: newRule.account,
        label: SNC_ACCOUNTS.find(a => a.code === newRule.account)?.label ?? newRule.account,
        active: true,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNewRule({ field: "supplier_nif", operator: "equals", value: "", account: "62" });
          toast.success("Regra adicionada", { description: "A regra será aplicada a novos documentos importados." });
        },
        onError: () => toast.error("Erro ao criar regra"),
      }
    );
  };

  return (
    <PageContainer
      title="Classificações"
      subtitle="Regras automáticas de classificação SNC por campo e valor"
      actions={
        <Button size="sm" className="h-9 text-sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova Regra
        </Button>
      }
    >
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-tim-info/20 bg-tim-info/5 px-4 py-3">
        <Zap className="h-4 w-4 shrink-0 text-tim-info" />
        <p className="text-sm text-muted-foreground">
          As regras são aplicadas por ordem de prioridade. A primeira regra que corresponder ao documento é usada para classificação automática.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-tim-danger/20 bg-tim-danger/5 py-16">
          <p className="text-sm text-tim-danger">Erro ao carregar regras de classificação</p>
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card py-16">
          <Tags className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-medium">Sem regras de classificação</p>
          <p className="mt-1 text-sm text-muted-foreground">Crie regras para classificar documentos automaticamente ao importar</p>
          <Button size="sm" variant="outline" className="mt-4 h-9 text-sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar primeira regra
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              onDelete={() => {
                deleteRule.mutate(rule.id, {
                  onSuccess: () => toast.success("Regra eliminada"),
                  onError: () => toast.error("Erro ao eliminar regra"),
                });
              }}
              onToggle={() => {
                updateRule.mutate(
                  { id: rule.id, patch: { active: !rule.active } },
                  { onError: () => toast.error("Erro ao atualizar regra") }
                );
              }}
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
                <label className="text-sm font-medium text-muted-foreground">Campo</label>
                <Select value={newRule.field} onValueChange={(v) => setNewRule((p) => ({ ...p, field: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Operador</label>
                <Select value={newRule.operator} onValueChange={(v) => setNewRule((p) => ({ ...p, operator: v }))}>
                  <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(OPERATOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-sm">{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Valor</label>
              <Input className="mt-1 h-9 text-sm" placeholder="ex: 500000001" value={newRule.value ?? ""} onChange={(e) => setNewRule((p) => ({ ...p, value: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Conta SNC</label>
              <Select value={newRule.account} onValueChange={(v) => setNewRule((p) => ({ ...p, account: v }))}>
                <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SNC_ACCOUNTS.map((a) => <SelectItem key={a.code} value={a.code} className="text-sm">{a.code} — {a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-9 text-sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" className="h-9 text-sm" onClick={addRule} disabled={createRule.isPending}>
              {createRule.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Adicionar Regra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
