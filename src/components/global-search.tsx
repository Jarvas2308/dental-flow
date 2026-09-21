import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, User } from "lucide-react";
import { useTable } from "@/hooks/use-data";
import type { Database } from "@/integrations/supabase/types";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";

type Paciente = Database["public"]["Tables"]["pacientes"]["Row"];

// Busca de paciente por ⌘K/Ctrl+K — mesma lista já usada em /pacientes,
// reaproveitada via cache do react-query (sem requisição extra).
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pacientes = useTable<Paciente>("pacientes", "nome", true);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function irParaPaciente(id: string) {
    setOpen(false);
    navigate({ to: "/pacientes/$id", params: { id } });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden w-64 items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary-border sm:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar paciente…</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10.5px]">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">Buscar paciente</DialogTitle>
        <CommandInput placeholder="Buscar paciente…" />
        <CommandList>
          <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
          <CommandGroup heading="Pacientes">
            {(pacientes.data ?? []).map((p) => (
              <CommandItem key={p.id} value={p.nome} onSelect={() => irParaPaciente(p.id)}>
                <User />
                {p.nome}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
