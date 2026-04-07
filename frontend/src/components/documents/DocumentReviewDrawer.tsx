import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { MobileDrawer } from "@/components/shared/MobileDrawer";
import { DocumentReviewContent } from "./DocumentReviewContent";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DocumentRecord } from "@/lib/documents-data";
import type { DocumentType } from "@/lib/documents-data";

export interface DocumentActions {
  onApprove: (id: string) => void;
  onReject: (id: string, reason?: string) => void;
  onReclassify: (id: string, newAccount: string, newDocType?: DocumentType | string) => void;
  onConfirmField: (docId: string, fieldIndex: number) => void;
  onArchive: (id: string) => void;
  onAcceptAiSuggestion: (id: string) => void;
  onAddNote: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onReprocess: (id: string) => void;
  onProcess?: (id: string) => void;
}

interface DocumentReviewDrawerProps {
  document: DocumentRecord | null;
  open: boolean;
  onClose: () => void;
  actions: DocumentActions;
}

export function DocumentReviewDrawer({
  document,
  open,
  onClose,
  actions,
}: DocumentReviewDrawerProps) {
  const isMobile = useIsMobile();

  if (!document) return null;

  const content = (
    <DocumentReviewContent
      document={document}
      actions={actions}
      onClose={onClose}
    />
  );

  if (isMobile) {
    return (
      <MobileDrawer open={open} onClose={onClose}>
        {content}
      </MobileDrawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full max-w-lg overflow-y-auto border-l bg-card p-0 sm:max-w-xl">
        {content}
      </SheetContent>
    </Sheet>
  );
}
