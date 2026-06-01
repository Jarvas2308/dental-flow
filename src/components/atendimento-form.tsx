import { useEffect, useMemo, useState } from "react";
import { useCreate, useTable, useUpdate } from "@/hooks/use-data";
import { brl, todayISO } from "@/lib/format";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Loader2, Pencil, Plus, CalendarClock, Wallet } from "lucide-react";
import { toast } from "sonner";

function QuickAdd({
  table, label, onCreated,
}: {
  table: "procedimentos" | "formas_pagamento";
  label: string;
  onCreated: (nome: string) => void;
}) {
  const create = useCreate(table);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [taxa, setTaxa] = useState("0");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return toast.error("Informe o nome");
    const values: any = { nome: nome.trim() };
    if (table === "formas_pagamento") values.taxa = Number(taxa) || 0;
    await create.mutateAsync(values);
    onCreated(nome.trim());
    setNome(""); setTaxa("0");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6"
          aria-label={`Adicionar ${label}`}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Novo {label}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input autoFocus required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          {table === "formas_pagamento" && (
            <div className="space-y-1.5">
              <Label>Taxa (%)</Label>
              <Input type="number" step="0.01" value={taxa} onChange={(e) => setTaxa(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


type Atendimento = {
  id?: string;
  paciente: string;
  procedimento: string;
  forma_pagamento: string;
  valor_bruto: number | string;
  taxa: number | string;
  valor_liquido?: number;
  data: string;
  nota_fiscal: boolean;
  status_pagamento: string;
};

const empty = (): Atendimento => ({
  paciente: "", procedimento: "", forma_pagamento: "",
  valor_bruto: "", taxa: 0, data: todayISO(),
  nota_fiscal: false, status_pagamento: "pago",
});

export function AtendimentoForm({
  editing, onClose, trigger,
}: {
  editing?: any;
  onClose?: () => void;
  trigger?: React.ReactNode;
}) {
  const procedimentos = useTable<any>("procedimentos", "nome", true);
  const formas = useTable<any>("formas_pagamento", "nome", true);
  const atendimentos = useTable<any>("atendimentos", "data");
  const create = useCreate("atendimentos");
  const update = useUpdate("atendimentos");
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Atendimento>(editing ? { ...editing } : empty());
  const [procOpen, setProcOpen] = useState(false);
  const [parcelado, setParcelado] = useState<boolean>(!!editing?.parcelado);
  const [parcelasN, setParcelasN] = useState<number>(editing?.parcelas_total > 1 ? editing.parcelas_total : 3);

  // Procedimentos ordenados por frequência de uso, com fallback alfabético
  const procedimentosOrdenados = useMemo(() => {
    const freq = new Map<string, number>();
    (atendimentos.data ?? []).forEach((a: any) => {
      if (a.procedimento) freq.set(a.procedimento, (freq.get(a.procedimento) ?? 0) + 1);
    });
    return [...(procedimentos.data ?? [])].sort((a, b) => {
      const fa = freq.get(a.nome) ?? 0;
      const fb = freq.get(b.nome) ?? 0;
      if (fb !== fa) return fb - fa;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [procedimentos.data, atendimentos.data]);

  useEffect(() => {
    if (open) {
      setV(editing ? { ...editing } : empty());
      setParcelado(!!editing?.parcelado);
      setParcelasN(editing?.parcelas_total > 1 ? editing.parcelas_total : 3);
    }
  }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const onForma = (val: string) => {
    const f = (formas.data ?? []).find((x) => x.nome === val);
    setV((p) => ({ ...p, forma_pagamento: val, taxa: f?.taxa ?? p.taxa }));
  };

  const valorLiquido = Math.max(0, Number(v.valor_bruto || 0) * (1 - Number(v.taxa || 0) / 100));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.procedimento) return toast.error("Selecione o procedimento");
    if (!v.forma_pagamento) return toast.error("Selecione a forma de pagamento");
    if (!Number(v.valor_bruto)) return toast.error("Informe o valor bruto");

    const usarParcelas = parcelado && parcelasN > 1;

    const payload = {
      paciente: v.paciente.trim(),
      procedimento: v.procedimento,
      forma_pagamento: v.forma_pagamento,
      valor_bruto: Number(v.valor_bruto),
      taxa: Number(v.taxa),
      valor_liquido: Number(valorLiquido.toFixed(2)),
      data: v.data,
      nota_fiscal: v.nota_fiscal,
      // Parcelado = contas a receber: fica pendente. O caixa é alimentado
      // pelos recebimentos reais registrados (de valores livres).
      status_pagamento: usarParcelas ? "pendente" : v.status_pagamento,
      parcelado: usarParcelas,
      parcelas_total: usarParcelas ? parcelasN : 1,
    };

    if (isEdit) {
      await update.mutateAsync({ id: editing.id, values: payload });
    } else {
      await create.mutateAsync(payload);
    }

    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isEdit && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" /> Novo atendimento</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar atendimento" : "Novo atendimento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Paciente</Label>
              <Input required value={v.paciente} onChange={(e) => setV({ ...v, paciente: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Procedimento</Label>
                <QuickAdd table="procedimentos" label="procedimento"
                  onCreated={(nome) => setV((p) => ({ ...p, procedimento: nome }))} />
              </div>
              <Popover open={procOpen} onOpenChange={setProcOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" aria-expanded={procOpen}
                    className={cn("w-full justify-between font-normal", !v.procedimento && "text-muted-foreground")}>
                    {v.procedimento || "Selecione ou busque..."}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar procedimento..." />
                    <CommandList>
                      <CommandEmpty>Nenhum procedimento. Cadastre em Cadastros.</CommandEmpty>
                      <CommandGroup>
                        {procedimentosOrdenados.map((p) => (
                          <CommandItem key={p.id} value={p.nome}
                            onSelect={(val) => { setV({ ...v, procedimento: val }); setProcOpen(false); }}>
                            <Check className={cn("h-4 w-4", v.procedimento === p.nome ? "opacity-100" : "opacity-0")} />
                            {p.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Forma de pagamento</Label>
                <QuickAdd table="formas_pagamento" label="forma de pagamento"
                  onCreated={(nome) => {
                    setTimeout(() => onForma(nome), 100);
                  }} />
              </div>
              <Select value={v.forma_pagamento} onValueChange={onForma}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(formas.data ?? []).map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome} ({p.taxa}%)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Taxa (%)</Label>
              <Input type="number" step="0.01" value={v.taxa}
                onChange={(e) => setV({ ...v, taxa: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor bruto (R$)</Label>
              <Input type="number" step="0.01" required value={v.valor_bruto}
                onChange={(e) => setV({ ...v, valor_bruto: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor líquido</Label>
              <div className="h-9 px-3 rounded-md border bg-muted/30 flex items-center text-sm font-medium">{brl(valorLiquido)}</div>
            </div>

            {/* Forma de recebimento */}
            <div className="sm:col-span-2 rounded-lg bg-muted/40 p-3 space-y-3">
              <Label className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Forma de recebimento
              </Label>
              <div className="inline-flex rounded-lg border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setParcelado(false)}
                  disabled={isEdit && !!editing?.parcelado}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-md transition-colors",
                    !parcelado ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  À vista
                </button>
                <button
                  type="button"
                  onClick={() => setParcelado(true)}
                  disabled={isEdit && !editing?.parcelado && false}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors",
                    parcelado ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Parcelado
                </button>
              </div>

              {parcelado ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Label className="shrink-0">Parcelas combinadas</Label>
                    <Select
                      value={String(parcelasN)}
                      onValueChange={(s) => setParcelasN(Number(s))}
                    >
                      <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Não gera parcelas fixas. Registre cada recebimento (de valor livre) em
                    Contas a Receber. Só o que for recebido entra no caixa.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <Label className="cursor-pointer">Pagamento recebido</Label>
                    <p className="text-xs text-muted-foreground">
                      {v.status_pagamento === "pago"
                        ? "Atendimento pago — entra nos totais"
                        : "Pendente — não entra no faturamento até quitar"}
                    </p>
                  </div>
                  <Switch
                    checked={v.status_pagamento === "pago"}
                    onCheckedChange={(c) => setV({ ...v, status_pagamento: c ? "pago" : "pendente" })}
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <Label className="cursor-pointer">Nota fiscal emitida</Label>
                <p className="text-xs text-muted-foreground">Marque se a NF já foi gerada</p>
              </div>
              <Switch checked={v.nota_fiscal} onCheckedChange={(c) => setV({ ...v, nota_fiscal: c })} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditAtendimentoButton({ row }: { row: any }) {
  const [editing, setEditing] = useState<any | null>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(row)}>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      {editing && <AtendimentoForm editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
