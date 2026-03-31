import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Wand2, Trash2, Loader2 } from "lucide-react";
import {
  useMovementRules,
  useCreateMovementRule,
  useDeleteMovementRule,
} from "@/hooks/use-movement-rules";
import type { MovementRule } from "@/lib/api";

function AddRuleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateMovementRule();
  const [form, setForm] = useState({
    name: "",
    pattern: "",
    category: "",
    snc_account: "",
    entity_nif: "",
    priority: 10,
    active: true,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    create.mutate(
      { ...form, entity_nif: form.entity_nif || null },
      {
        onSuccess: () => {
          onClose();
          setForm({ name: "", pattern: "", category: "", snc_account: "", entity_nif: "", priority: 10, active: true });
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Regra de Movimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input placeholder="EDP — Eletricidade" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Padrão (regex na descrição)</Label>
            <Input placeholder="(?i)edp.*distribui" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} required className="font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <Input placeholder="Eletricidade" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <div>
              <Label>Conta SNC</Label>
              <Input placeholder="6241" value={form.snc_account} onChange={(e) => setForm({ ...form, snc_account: e.target.value })} className="font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>NIF Entidade (opcional)</Label>
              <Input placeholder="504165873" value={form.entity_nif} onChange={(e) => setForm({ ...form, entity_nif: e.target.value })} maxLength={9} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Input type="number" min={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            <Label>Ativa</Label>
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

export default function MovementRules() {
  const { data: rules, isLoading, error } = useMovementRules();
  const deleteMut = useDeleteMovementRule();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  if (error) return <PageContainer title="Regras de Movimentos"><ErrorState title="Erro ao carregar regras" /></PageContainer>;

  return (
    <PageContainer
      title="Regras de Movimentos"
      subtitle="Classificação automática de movimentos bancários por padrão"
      actions={
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : (!rules || rules.length === 0) ? (
        <EmptyState
          icon={Wand2}
          title="Sem regras"
          description="Crie regras para classificar automaticamente movimentos bancários com base em padrões de texto."
          actionLabel="Nova Regra"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Prio</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Padrão</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-[100px]">SNC</TableHead>
                <TableHead className="w-[80px]">Estado</TableHead>
                <TableHead className="w-[60px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-mono text-sm text-center">{rule.priority}</TableCell>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{rule.pattern}</TableCell>
                  <TableCell className="text-sm">{rule.category || "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{rule.snc_account || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={rule.active ? "bg-tim-success/15 text-tim-success border-tim-success/30 text-xs" : "bg-muted text-muted-foreground text-xs"}>
                      {rule.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(rule.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddRuleDialog open={showAdd} onClose={() => setShowAdd(false)} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Eliminar regra?"
        description="A classificação automática deixará de usar esta regra."
        onConfirm={() => {
          if (deleteId) deleteMut.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </PageContainer>
  );
}
