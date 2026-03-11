import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navigation } from "@/lib/navigation";
import { useNavigate } from "react-router-dom";
import { FileText, Zap } from "lucide-react";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Pesquisar páginas, documentos, ações..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        <CommandGroup heading="Navegação">
          {navigation.flatMap((group) =>
            group.items.map((item) => (
              <CommandItem
                key={item.path}
                onSelect={() => handleSelect(item.path)}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.label}
                </span>
              </CommandItem>
            ))
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Documentos Recentes">
          <CommandItem>
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Fatura #2024-0847</span>
          </CommandItem>
          <CommandItem>
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Recibo #RC-0231</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações Rápidas">
          <CommandItem>
            <Zap className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Importar documento</span>
          </CommandItem>
          <CommandItem>
            <Zap className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Classificar movimentos pendentes</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandMenu() {
  return {
    open: () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true })
      );
    },
  };
}
