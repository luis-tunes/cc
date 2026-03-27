import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchAssistantPrompts, sendAssistantMessage, type QuickPrompt, type ChatResponse } from "@/lib/api";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  timestamp: Date;
}

export function useAssistantPrompts() {
  return useQuery<QuickPrompt[]>({
    queryKey: ["assistant-prompts"],
    queryFn: fetchAssistantPrompts,
    staleTime: Infinity,
  });
}

export function useAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Olá! Sou o assistente xtim. Posso consultar os seus dados contabilísticos em tempo real — documentos, movimentos, reconciliações, IVA e muito mais. Como posso ajudá-lo?",
      timestamp: new Date(),
    },
  ]);

  const mutation = useMutation<ChatResponse, Error, string>({
    mutationFn: sendAssistantMessage,
    onMutate: (question) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: question,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        intent: data.intent,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
    onError: () => {
      const errMsg: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Ocorreu um erro ao processar a sua pergunta. Tente novamente.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    },
  });

  function sendMessage(question: string) {
    if (!question.trim() || mutation.isPending) return;
    mutation.mutate(question.trim());
  }

  function clearMessages() {
    setMessages([
      {
        id: "welcome-reset",
        role: "assistant",
        content:
          "Olá! Sou o assistente xtim. Como posso ajudá-lo?",
        timestamp: new Date(),
      },
    ]);
  }

  return { messages, sendMessage, clearMessages, isPending: mutation.isPending };
}
