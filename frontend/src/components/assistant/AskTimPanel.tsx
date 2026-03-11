import { cn } from "@/lib/utils";
import { useState } from "react";
import { quickPrompts } from "@/lib/assistant-data";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, Clock, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface QueryResult {
  query: string;
  answer: string;
  timestamp: string;
}

export function AskTimPanel({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([
    {
      query: "Qual é o estado das minhas obrigações?",
      answer: "Tem **2 obrigações urgentes**: Segurança Social (2 dias) e Revisão contabilista (7 dias). A declaração de IVA T1 está em preparação com 45% de prontidão — tem 3 faturas sem classificação IVA e 12 reconciliações pendentes a resolver. O Modelo 22 está a 84 dias mas requer encerramento de contas 2023.",
      timestamp: "08:42",
    },
  ]);

  const handleSubmit = () => {
    if (!query.trim()) return;
    setIsThinking(true);
    const q = query;
    setQuery("");

    setTimeout(() => {
      setResults((prev) => [
        {
          query: q,
          answer: "Baseado nos dados atuais, identifico que os gastos com FSE aumentaram 18% face ao período homólogo. Os principais drivers são subcontratos (+€4.200) e serviços especializados (+€2.800). Recomendo rever os contratos com ABC Materiais e Consultoria Pro para otimização.",
          timestamp: new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev,
      ]);
      setIsThinking(false);
    }, 1500);
  };

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Pergunte ao TIM</h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Input */}
        <div className="relative">
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pergunte sobre a sua operação financeira..."
            className="min-h-[72px] resize-none pr-12 text-sm bg-muted/30 border-border"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            onClick={handleSubmit}
            disabled={!query.trim() || isThinking}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Quick prompts */}
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Perguntas Rápidas</p>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.slice(0, 4).map((p, i) => (
              <button
                key={i}
                className="rounded-md bg-muted px-2.5 py-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-left"
                onClick={() => setQuery(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Thinking state */}
        {isThinking && (
          <div className="flex items-center gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5">
            <div className="flex gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-xs text-primary">A analisar dados...</span>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
              <Clock className="inline h-3 w-3 mr-1" />
              Consultas Recentes
            </p>
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className="rounded-md border px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-foreground">{r.query}</p>
                    <span className="text-[9px] text-muted-foreground shrink-0">{r.timestamp}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-line">{r.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
