import { useCallback, useEffect, useState, useMemo } from "react";
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
import { FileText, Zap, Upload, Clock, Truck, Keyboard } from "lucide-react";
import { useDocuments } from "@/hooks/use-documents";
import { useSuppliers } from "@/hooks/use-inventory";

const RECENTS_KEY = "tim-cmd-recents";
const MAX_RECENTS = 5;

function getRecents(): { label: string; path: string }[] {
  try {
    return JSON.parse(sessionStorage.getItem(RECENTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function pushRecent(label: string, path: string) {
  const prev = getRecents().filter((r) => r.path !== path);
  const next = [{ label, path }, ...prev].slice(0, MAX_RECENTS);
  sessionStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { documents } = useDocuments();
  const { data: suppliers = [] } = useSuppliers();

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

  const handleSelect = useCallback(
    (label: string, path: string) => {
      pushRecent(label, path);
      navigate(path);
      setOpen(false);
    },
    [navigate],
  );

  const recents = useMemo(() => (query ? [] : getRecents()), [query, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDocs = useMemo(() => {
    const q = query.toLowerCase();
    const base = documents.slice(0, 50);
    if (!q) return base.slice(0, 5);
    return base
      .filter(
        (d) =>
          d.supplier?.toLowerCase().includes(q) ||
          d.documentType?.toLowerCase().includes(q) ||
          d.date?.includes(q),
      )
      .slice(0, 5);
  }, [documents, query]);

  const filteredSuppliers = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return [];
    return suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.nif?.includes(q)).slice(0, 5);
  }, [suppliers, query]);

  const filteredNav = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return navigation.flatMap((g) => g.items.filter((i) => i.status === "active"));
    return navigation.flatMap((g) =>
      g.items.filter((i) => i.status === "active" && i.title.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Pesquisar páginas, documentos, fornecedores, ações..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {recents.length > 0 && (
          <CommandGroup heading="Recentes">
            {recents.map((r) => (
              <CommandItem key={r.path} value={`recent-${r.path}`} onSelect={() => handleSelect(r.label, r.path)}>
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{r.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredNav.length > 0 && (
          <>
            {recents.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Navegação">
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.path}
                  value={item.title}
                  onSelect={() => handleSelect(item.title, item.path)}
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {filteredDocs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Documentos">
              {filteredDocs.map((doc) => (
                <CommandItem
                  key={doc.id}
                  value={`doc-${doc.id}-${doc.supplier}`}
                  onSelect={() => handleSelect(doc.supplier || "Documento", "/documentos")}
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

        {filteredSuppliers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Fornecedores">
              {filteredSuppliers.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`supplier-${s.id}-${s.name}`}
                  onSelect={() => handleSelect(s.name, "/fornecedores")}
                >
                  <Truck className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.nif && <span className="ml-auto font-mono text-xs text-muted-foreground">{s.nif}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Ações Rápidas">
          <CommandItem
            value="importar documento upload"
            onSelect={() => handleSelect("Importar documento", "/caixa-entrada")}
          >
            <Upload className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Importar documento</span>
          </CommandItem>
          <CommandItem
            value="reconciliar movimentos"
            onSelect={() => handleSelect("Reconciliação", "/reconciliacao")}
          >
            <Zap className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Ir para Reconciliação</span>
          </CommandItem>
          <CommandItem
            value="centro fiscal iva irc"
            onSelect={() => handleSelect("Centro Fiscal", "/centro-fiscal")}
          >
            <Zap className="mr-2 h-4 w-4 text-tim-gold" />
            <span>Centro Fiscal</span>
          </CommandItem>
          <CommandItem
            value="atalhos teclado keyboard"
            onSelect={() => {
              setOpen(false);
              document.dispatchEvent(new KeyboardEvent("keydown", { key: "?" }));
            }}
          >
            <Keyboard className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Atalhos de teclado</span>
            <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">?</span>
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
