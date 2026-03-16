import { useEffect, useState, useMemo } from "react";
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
import { FileText, Zap, Upload } from "lucide-react";
import { useDocuments } from "@/hooks/use-documents";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { documents } = useDocuments();

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

  const filteredDocs = useMemo(() => {
    const q = query.toLowerCase();
    const base = documents.slice(0, 50);
    if (!q) return base.slice(0, 5);
    return base
      .filter(
        (d) =>
          d.supplier?.toLowerCase().includes(q) ||
          d.documentType?.toLowerCase().includes(q) ||
          d.date?.includes(q)
      )
      .slice(0, 5);
  }, [documents, query]);

  const filteredNav = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return navigation.flatMap((g) => g.items.filter((i) => i.status === "active"));
    return navigation.flatMap((g) =>
      g.items.filter((i) => i.status === "active" && i.title.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Pesquisar páginas, documentos, ações..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {filteredNav.length > 0 && (
          <CommandGroup heading="Navegação">
            {filteredNav.map((item) => (
              <CommandItem
                key={item.path}
                value={item.title}
                onSelect={() => handleSelect(item.path)}
              >
                <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredDocs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Documentos">
              {filteredDocs.map((doc) => (
                <CommandItem
                  key={doc.id}
                  value={`doc-${doc.id}-${doc.supplier}`}
                  onSelect={() => handleSelect("/documentos")}
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {doc.supplier || "—"} · {doc.documentType}
                  </span>
                  {doc.date && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {doc.date}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Ações Rápidas">
          <CommandItem
            value="importar documento upload"
            onSelect={() => { handleSelect("/caixa-entrada"); }}
          >
            <Upload className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Importar documento</span>
          </CommandItem>
          <CommandItem
            value="reconciliar movimentos"
            onSelect={() => handleSelect("/reconciliacao")}
          >
            <Zap className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Ir para Reconciliação</span>
          </CommandItem>
          <CommandItem
            value="centro fiscal iva irc"
            onSelect={() => handleSelect("/centro-fiscal")}
          >
            <Zap className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Centro Fiscal</span>
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
