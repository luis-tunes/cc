import { cn } from "@/lib/utils";
import { useState } from "react";
import { draftMessages, type DraftMessage } from "@/lib/assistant-data";
import { Mail, FileText, MessageSquare, Copy, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const typeConfig = {
  lembrete: { label: "Lembrete", icon: Mail, color: "text-tim-warning", bg: "bg-tim-warning/10" },
  "follow-up": { label: "Seguimento", icon: MessageSquare, color: "text-tim-info", bg: "bg-tim-info/10" },
  resumo: { label: "Resumo", icon: FileText, color: "text-primary", bg: "bg-primary/10" },
};

export function CommunicationDrafts({ className }: { className?: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Rascunhos de Comunicação</h3>
      </div>

      <div className="divide-y divide-border">
        {draftMessages.map((draft) => {
          const cfg = typeConfig[draft.type];
          const TypeIcon = cfg.icon;
          const isExpanded = expandedId === draft.id;

          return (
            <div key={draft.id} className="px-4 py-3">
              <div
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : draft.id)}
              >
                <div className={cn("flex h-7 w-7 items-center justify-center rounded shrink-0", cfg.bg)}>
                  <TypeIcon className={cn("h-3.5 w-3.5", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium uppercase", cfg.bg, cfg.color)}>{cfg.label}</span>
                    <span className="text-[9px] text-muted-foreground">{draft.generatedAt}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-foreground truncate">{draft.subject}</p>
                  <p className="text-[10px] text-muted-foreground">Para: {draft.recipient}</p>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 rounded-md border bg-muted/30 px-3 py-2.5">
                  <pre className="whitespace-pre-wrap text-[11px] text-foreground font-sans leading-relaxed">{draft.body}</pre>
                  <div className="mt-3 flex gap-2 border-t pt-2">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { navigator.clipboard.writeText(draft.body); toast.success("Copiado"); }}>
                      <Copy className="mr-1 h-3 w-3" />
                      Copiar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]">
                      <Pencil className="mr-1 h-3 w-3" />
                      Editar
                    </Button>
                    <Button size="sm" className="h-7 text-[10px] ml-auto" disabled>
                      <Mail className="mr-1 h-3 w-3" />
                      Enviar (em breve)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
