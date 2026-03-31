import { DocumentReviewContent } from "./DocumentReviewContent";
import type { DocumentRecord } from "@/lib/documents-data";
import type { DocumentActions } from "./DocumentReviewDrawer";

interface DocumentReviewPanelProps {
  document: DocumentRecord;
  actions: DocumentActions;
  onClose: () => void;
}

export function DocumentReviewPanel({
  document,
  actions,
  onClose,
}: DocumentReviewPanelProps) {
  return (
    <div className="sticky top-0 h-[calc(100vh-4rem)] overflow-y-auto rounded-lg border bg-card">
      <DocumentReviewContent
        document={document}
        actions={actions}
        onClose={onClose}
        largePreview
      />
    </div>
  );
}
