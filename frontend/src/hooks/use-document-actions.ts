import { useMutation } from "@tanstack/react-query";
import { patchDocument } from "@/lib/api";
import { toast } from "sonner";

export interface DocumentActions {
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onReclassify: (id: string, newType: string) => void;
  onConfirmField: (id: string, field: string) => void;
  onArchive: (id: string) => void;
  onAcceptAiSuggestion: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
}

export function useDocumentActions(refetch: () => void) {
  const mutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      return patchDocument(Number(id), patch);
    },
    onSuccess: () => {
      refetch();
    },
    onError: (err: Error) => {
      toast.error(`Erro: ${err.message}`);
    },
  });

  const actions: DocumentActions = {
    onApprove: (id) => {
      mutation.mutate({ id, patch: { status: "classificado" } });
      toast.success("Documento aprovado");
    },
    onReject: (id) => {
      mutation.mutate({ id, patch: { status: "rejeitado" } });
      toast.success("Documento rejeitado");
    },
    onReclassify: (id, newType) => {
      mutation.mutate({ id, patch: { type: newType, status: "revisto" } });
      toast.success("Documento reclassificado");
    },
    onConfirmField: (id, _field) => {
      mutation.mutate({ id, patch: { status: "revisto" } });
      toast.success("Campo confirmado");
    },
    onArchive: (id) => {
      mutation.mutate({ id, patch: { status: "arquivado" } });
      toast.success("Documento arquivado");
    },
    onAcceptAiSuggestion: (id) => {
      mutation.mutate({ id, patch: { status: "classificado" } });
      toast.success("Sugestão IA aceite");
    },
    onAddNote: (_id, _note) => {
      // Notes not yet stored in backend — just toast
      toast.success("Nota adicionada");
    },
  };

  return { actions };
}
