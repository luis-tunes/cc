import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { Bot, Send, RotateCcw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/PageContainer";
import { useAssistant, useAssistantPrompts } from "@/hooks/use-assistant";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  fiscal:       "bg-amber-100 text-amber-800 border-amber-200",
  operacional:  "bg-blue-100  text-blue-800  border-blue-200",
  análise:      "bg-green-100 text-green-800 border-green-200",
  comunicação:  "bg-purple-100 text-purple-800 border-purple-200",
};

function MessageBubble({ role, content, timestamp }: { role: "user" | "assistant"; content: string; timestamp: Date }) {
  const isUser = role === "user";
  // Split content into segments: plain text and **bold** markers
  const parts = content.split(/(\*\*.+?\*\*)/g);
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted border"
      )}>
        {isUser ? "EU" : <Bot className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-card border rounded-tl-sm"
      )}>
        <p className="whitespace-pre-wrap">
          {parts.map((part, i) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={i}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
        <p className={cn("text-xs mt-1 opacity-60", isUser ? "text-right" : "text-left")}>
          {timestamp.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const { messages, sendMessage, clearMessages, isPending } = useAssistant();
  const { data: prompts = [] } = useAssistantPrompts();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim() || isPending) return;
    sendMessage(input);
    setInput("");
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handlePrompt(prompt: string) {
    sendMessage(prompt);
    textareaRef.current?.focus();
  }

  return (
    <PageContainer
      title="Assistente IA"
      subtitle="Consulte os seus dados contabilísticos em linguagem natural"
    >
      <div className="flex flex-col h-[calc(100dvh-12rem)] max-w-3xl mx-auto gap-4">
        {/* Quick prompts */}
        {prompts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePrompt(p.prompt)}
                disabled={isPending}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "hover:opacity-80 disabled:opacity-40",
                  categoryColors[p.category] ?? "bg-muted text-foreground border-border"
                )}
              >
                <Sparkles className="inline h-3.5 w-3.5 mr-1 opacity-70" />
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto rounded-xl border bg-muted/30 p-4 space-y-4 scroll-smooth">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} timestamp={msg.timestamp} />
          ))}
          {isPending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted border flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva a sua pergunta... (Enter para enviar)"
            className="resize-none min-h-[44px] max-h-32 text-sm"
            rows={1}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isPending} size="icon" className="h-11 w-11 shrink-0" aria-label="Enviar mensagem">
            <Send className="h-4 w-4" />
          </Button>
          <Button onClick={clearMessages} variant="outline" size="icon" className="h-11 w-11 shrink-0" title="Limpar conversa" aria-label="Limpar conversa">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

