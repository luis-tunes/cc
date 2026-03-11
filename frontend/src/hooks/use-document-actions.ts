import { useCallback } from "react";
import { toast } from "sonner";
import type { DocumentType } from "@/lib/documents-data";
import type { DocumentActions } from "@/components/documents/DocumentReviewDrawer";

/**
 * Document review actions — approve, reject, reclassify, archive, etc.
 * Currently stubs that show toast feedback.
 * TODO: Wire to PATCH /api/documents/:id once backend supports it.
 */
export function useDocumentActions(refetch: () => void) {
  const updateDoc = useCallback(
    async (_id: string, _updates: Record<string, any>) => {
      // TODO: call PATCH /api/documents/:id
      await new Promise((r) => setTimeout(r, 300));
      refetch();
      return true;
    },
    [refetch]
  );

  const appendNote = useCallback(
    async (id: string, note: string) => {
      console.log(`[stub] appendNote doc=${id} note="${note}"`);
      return updateDoc(id, { notes: note });
    },
    [updateDoc]
  );

  const actions: DocumentActions = {
    onApprove: useCallback(
      async (id: string) => {
        const ok = await updateDoc(id, {
          classification_status: "revisto",
          needs_review: false,
        });
        if (ok) toast.success("Documento aprovado");
      },
      [updateDoc]
    ),

    onReject: useCallback(
      async (id: string, reason: string) => {
        await appendNote(id, `[Rejeitado] ${reason}`);
        const ok = await updateDoc(id, {
          classification_status: "pendente",
          needs_review: true,
        });
        if (ok) toast.error("Documento rejeitado");
      },
      [updateDoc, appendNote]
    ),

    onReclassify: useCallback(
      async (id: string, newAccount: string, newDocType: DocumentType) => {
        await appendNote(id, `[Reclassificado] Conta SNC: ${newAccount}`);
        const ok = await updateDoc(id, {
          document_type: newDocType,
          classification_status: "classificado",
          needs_review: false,
          ai_suggested_account: newAccount,
        });
        if (ok) toast.success(`Reclassificado para conta ${newAccount}`);
      },
      [updateDoc, appendNote]
    ),

    onConfirmField: useCallback(
      async (docId: string, fieldIndex: number) => {
        console.log(
          `[stub] confirmField doc=${docId} field=${fieldIndex}`
        );
        toast.success("Campo confirmado");
        refetch();
      },
      [refetch]
    ),

    onArchive: useCallback(
      async (id: string) => {
        const ok = await updateDoc(id, {
          classification_status: "arquivado",
          needs_review: false,
        });
        if (ok) toast.success("Documento arquivado");
      },
      [updateDoc]
    ),

    onAcceptAiSuggestion: useCallback(
      async (id: string) => {
        await appendNote(id, `[IA] Classificação automática aceite`);
        const ok = await updateDoc(id, {
          classification_status: "classificado",
          needs_review: false,
        });
        if (ok) toast.success("Classificação IA aceite");
      },
      [updateDoc, appendNote]
    ),

    onAddNote: useCallback(
      async (id: string, note: string) => {
        const ok = await appendNote(id, note);
        if (ok) toast.success("Nota adicionada");
      },
      [appendNote]
    ),
  };

  return { actions };
}
