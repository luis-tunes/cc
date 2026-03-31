import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Keyboard } from "lucide-react";

interface Shortcut {
  keys: string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const groups: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], label: "Abrir pesquisa" },
      { keys: ["?"], label: "Atalhos de teclado" },
      { keys: ["G", "H"], label: "Ir para Painel" },
      { keys: ["G", "D"], label: "Ir para Documentos" },
      { keys: ["G", "R"], label: "Ir para Reconciliação" },
    ],
  },
  {
    title: "Visualizador de Documentos",
    shortcuts: [
      { keys: ["+"], label: "Zoom in" },
      { keys: ["-"], label: "Zoom out" },
      { keys: ["0"], label: "Repor zoom" },
      { keys: ["R"], label: "Rodar" },
      { keys: ["←", "→", "↑", "↓"], label: "Mover imagem" },
      { keys: ["Esc"], label: "Fechar" },
    ],
  },
  {
    title: "Tabelas",
    shortcuts: [
      { keys: ["↑", "↓"], label: "Navegar linhas" },
      { keys: ["Enter"], label: "Abrir detalhe" },
    ],
  },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "?") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-[340px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Atalhos de Teclado
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {g.title}
              </h3>
              <div className="space-y-2">
                {g.shortcuts.map((s) => (
                  <div key={s.label} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{s.label}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="flex h-6 min-w-6 items-center justify-center rounded-md border bg-muted px-1.5 text-[11px] font-medium text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
