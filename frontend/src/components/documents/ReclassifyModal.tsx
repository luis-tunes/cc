import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tags } from "lucide-react";
import { documentTypeLabels, type DocumentType } from "@/lib/documents-data";

// SNC account options for reclassification
export const SNC_ACCOUNTS = [
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

interface ReclassifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAccount?: string;
  currentDocType: DocumentType | string;
  onReclassify: (account: string, docType?: string) => void;
}

export function ReclassifyModal({
  open,
  onOpenChange,
  currentAccount,
  currentDocType,
  onReclassify,
}: ReclassifyModalProps) {
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | "">("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!selectedAccount) return;
    onReclassify(selectedAccount, selectedDocType || undefined);
    onOpenChange(false);
    setSelectedAccount("");
    setSelectedDocType("");
    setReason("");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      setSelectedAccount("");
      setSelectedDocType("");
      setReason("");
    }
    onOpenChange(o);
  };

  const currentLabel = currentAccount
    ? SNC_ACCOUNTS.find((a) => a.value === currentAccount)?.label || currentAccount
    : "Não classificado";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px] border-border bg-card backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Tags className="h-4 w-4 text-primary" />
            Reclassificar Documento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Classificação atual:
            </label>
            <div className="mt-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {currentLabel}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Nova classificação:
            </label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecionar conta SNC…" />
              </SelectTrigger>
              <SelectContent>
                {SNC_ACCOUNTS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Tipo de documento:
            </label>
            <Select
              value={selectedDocType || currentDocType}
              onValueChange={(v) => setSelectedDocType(v as DocumentType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(documentTypeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Motivo (opcional):
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Classificação incorreta, deveria ser FSE…"
              className="mt-1 min-h-[60px] text-sm resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!selectedAccount} onClick={handleSubmit}>
            <Tags className="mr-1.5 h-4 w-4" />
            Reclassificar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
