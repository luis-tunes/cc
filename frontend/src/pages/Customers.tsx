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
import { Plus, Users, Search, Trash2, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useCustomers,
  useCreateCustomer,
  usePatchCustomer,
  useDeleteCustomer,
  type Customer,
  type CustomerCreate,
} from "@/hooks/use-customers";
import { useIsMobile } from "@/hooks/use-mobile";

function CustomerDialog({
  open,
  onClose,
  editCustomer,
}: {
  open: boolean;
  onClose: () => void;
  editCustomer?: Customer;
}) {
  const create = useCreateCustomer();
  const patch = usePatchCustomer();
  const [form, setForm] = useState<CustomerCreate>({
    name: editCustomer?.name ?? "",
    nif: editCustomer?.nif ?? "",
    email: editCustomer?.email ?? "",
    phone: editCustomer?.phone ?? "",
    address: editCustomer?.address ?? "",
    postal_code: editCustomer?.postal_code ?? "",
    city: editCustomer?.city ?? "",
    country: editCustomer?.country ?? "PT",
    notes: editCustomer?.notes ?? "",
  });

  // Reset form when dialog opens with new data
  const prevEdit = useState(editCustomer?.id)[0];
  if (editCustomer && editCustomer.id !== prevEdit) {
    setForm({
      name: editCustomer.name,
      nif: editCustomer.nif,
      email: editCustomer.email,
      phone: editCustomer.phone,
      address: editCustomer.address,
      postal_code: editCustomer.postal_code,
      city: editCustomer.city,
      country: editCustomer.country,
      notes: editCustomer.notes,
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editCustomer) {
      patch.mutate({ id: editCustomer.id, data: form }, { onSuccess: onClose });
    } else {
      create.mutate(form, {
        onSuccess: () => {
          onClose();
          setForm({ name: "", nif: "", email: "", phone: "", address: "", postal_code: "", city: "", country: "PT", notes: "" });
        },
      });
    }
  }

  const isPending = create.isPending || patch.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editCustomer ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome</Label>
              <Input placeholder="Empresa ABC Lda" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <Label>NIF</Label>
              <Input placeholder="123456789" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} maxLength={9} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" placeholder="geral@empresa.pt" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input placeholder="+351 xxx xxx xxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input placeholder="Lisboa" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Morada</Label>
              <Input placeholder="Rua..." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Código Postal</Label>
              <Input placeholder="1000-001" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
            </div>
            <div>
              <Label>País</Label>
              <Input placeholder="PT" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} maxLength={2} />
            </div>
          </div>
          <div>
            <Label>Notas</Label>
            <Input placeholder="Notas internas..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editCustomer ? "Guardar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: customers, isLoading, error } = useCustomers(search || undefined);
  const deleteMut = useDeleteCustomer();
  const isMobile = useIsMobile();

  if (error) return <PageContainer title="Clientes"><ErrorState title="Erro ao carregar clientes" /></PageContainer>;

  return (
    <PageContainer
      title="Clientes"
      subtitle="Gestão de clientes e parceiros"
      actions={
        <Button onClick={() => { setEditCustomer(undefined); setShowDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Cliente
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por nome, NIF ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-tim-gold" />
        </div>
      ) : (!customers || customers.length === 0) ? (
        <EmptyState
          icon={Users}
          title="Sem clientes"
          description="Adicione clientes para começar a emitir faturas e gerir cobranças."
          actionLabel="Novo Cliente"
          onAction={() => setShowDialog(true)}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[120px]">NIF</TableHead>
                {!isMobile && <TableHead>Email</TableHead>}
                {!isMobile && <TableHead>Cidade</TableHead>}
                <TableHead className="w-[80px]">Estado</TableHead>
                <TableHead className="w-[100px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className={cn(!c.active && "opacity-50")}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm">{c.nif || "—"}</TableCell>
                  {!isMobile && <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>}
                  {!isMobile && <TableCell className="text-sm">{c.city || "—"}</TableCell>}
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", c.active ? "bg-tim-success/15 text-tim-success border-tim-success/30" : "bg-muted text-muted-foreground")}>
                      {c.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditCustomer(c); setShowDialog(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerDialog
        open={showDialog}
        onClose={() => setShowDialog(false)}
        editCustomer={editCustomer}
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Eliminar cliente?"
        description="Esta ação não pode ser revertida."
        onConfirm={() => {
          if (deleteId) deleteMut.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </PageContainer>
  );
}
