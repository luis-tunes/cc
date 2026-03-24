import { useMutation } from "@tanstack/react-query";
import { patchDocument, deleteDocument, bulkDeleteDocuments, fetchClassificationSuggestion, reprocessDocument } from "@/lib/api";
import { toast } from "sonner";

export interface DocumentActions {
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onReclassify: (id: string, newType: string, newDocType?: string) => void;
  onConfirmField: (docId: string, fieldIndex: number) => void;
  onArchive: (id: string) => void;
  onAcceptAiSuggestion: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onReprocess: (id: string) => void;
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return deleteDocument(Number(id));
    },
    onSuccess: () => {
      refetch();
      toast.success("Documento eliminado");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao eliminar: ${err.message}`);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return bulkDeleteDocuments(ids.map(Number));
    },
    onSuccess: () => {
      refetch();
      toast.success("Documentos eliminados");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao eliminar: ${err.message}`);
    },
  });

  const reprocessMutation = useMutation({
    mutationFn: async (id: string) => {
      return reprocessDocument(Number(id));
    },
    onSuccess: () => {
      refetch();
      toast.success("Documento reprocessado");
    },
    onError: (err: Error) => {
      toast.error(`Erro ao reprocessar: ${err.message}`);
    },
  });

  function withUndo(
    id: string,
    patch: Record<string, any>,
    undoPatch: Record<string, any>,
    label: string
  ) {
    mutation.mutate({ id, patch });
    toast.success(label, {
      action: {
        label: "Desfazer",
        onClick: () => {
          mutation.mutate({ id, patch: undoPatch });
          toast.info("Ação desfeita");
        },
      },
      duration: 5000,
    });
  }

  const actions: DocumentActions = {
    onApprove: (id) => {
      mutation.mutate({ id, patch: { status: "classificado" } });
      toast.success("Documento aprovado");
    },
    onReject: (id, _reason?) => {
      withUndo(id, { status: "rejeitado" }, { status: "pendente" }, "Documento rejeitado");
    },
    onReclassify: (id, newAccount, newDocType?) => {
      const patch: Record<string, any> = { snc_account: newAccount, status: "revisto" };
      if (newDocType) patch.type = newDocType;
      mutation.mutate({ id, patch });
      toast.success("Documento reclassificado");
    },
    onConfirmField: (id, _fieldIndex) => {
      mutation.mutate({ id, patch: { status: "revisto" } });
      toast.success("Campo confirmado");
    },
    onArchive: (id) => {
      withUndo(id, { status: "arquivado" }, { status: "pendente" }, "Documento arquivado");
    },
    onAcceptAiSuggestion: (id) => {
      fetchClassificationSuggestion(Number(id))
        .then((suggestion) => {
          mutation.mutate({ id, patch: { status: "classificado", snc_account: suggestion.account } });
          toast.success("Sugestão IA aceite");
        })
        .catch(() => {
          mutation.mutate({ id, patch: { status: "classificado" } });
          toast.success("Documento aprovado");
        });
    },
    onAddNote: (id, note) => {
      mutation.mutate({ id, patch: { notes: note } });
      toast.success("Nota guardada");
    },
    onDelete: (id) => {
      deleteMutation.mutate(id);
    },
    onBulkDelete: (ids) => {
      bulkDeleteMutation.mutate(ids);
    },
    onReprocess: (id) => {
      reprocessMutation.mutate(id);
    },
  };

  return { actions };
}
