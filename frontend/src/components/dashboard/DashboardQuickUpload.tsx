import { useState } from "react";
import { Upload, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalUploadModal } from "@/components/global/GlobalUploadModal";

export function DashboardQuickUpload() {
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setUploadOpen(true)}
        className={cn(
          "group flex items-center gap-4 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] px-5 py-4 transition-all",
          "hover:border-primary/50 hover:bg-primary/[0.06] hover:shadow-[0_0_20px_-4px_hsl(var(--tim-gold)/0.15)]",
          "active:scale-[0.99]"
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/15 relative">
          <Upload className="h-5 w-5 text-primary" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-foreground">
            Carregar novo ficheiro
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Arraste ou clique para adicionar faturas, recibos ou documentos
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>

      <GlobalUploadModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </>
  );
}
