import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreate, useTable, useUpdate } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
import { Check, ChevronDown, ChevronsUpDown, Loader2, Pencil, Plus, CalendarClock, Wallet, Trash2, UserPlus, Split } from "lucide-react";
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

// Combobox de paciente com autocomplete e criação rápida.
export function PacienteCombobox({
  value, onChange,
}: {
  value: string;
  onChange: (nome: string, id: string | null) => void;
}) {
  const pacientes = useTable<any>("pacientes", "nome", true);
  const atendimentos = useTable<any>("atendimentos", "data");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const nomes = useMemo(() => {
    const set = new Set<string>();
    (pacientes.data ?? []).forEach((p) => p.nome && set.add(p.nome));
    (atendimentos.data ?? []).forEach((a) => a.paciente && set.add(a.paciente));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [pacientes.data, atendimentos.data]);

  // Mapa nome (case-insensitive, trim) -> id do paciente.
  const idPorNome = useMemo(() => {
    const map = new Map<string, string>();
    (pacientes.data ?? []).forEach((p) => {
      if (p.nome) map.set(p.nome.trim().toLowerCase(), p.id);
    });
    return map;
  }, [pacientes.data]);

  const exists = nomes.some((n) => n.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}>
          {value || "Selecione ou busque..."}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar paciente..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhum paciente encontrado.</CommandEmpty>
            {search.trim() && !exists && (
              <CommandGroup>
                <CommandItem value={`__novo__${search}`} onSelect={() => { onChange(search.trim(), null); setSearch(""); setOpen(false); }}>
                  <UserPlus className="h-4 w-4" /> Criar "{search.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {nomes.map((n) => (
                <CommandItem key={n} value={n}
                  onSelect={(val) => { onChange(val, idPorNome.get(val.trim().toLowerCase()) ?? null); setSearch(""); setOpen(false); }}>
                  <Check className={cn("h-4 w-4", value === n ? "opacity-100" : "opacity-0")} />
                  {n}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Combobox de procedimento (com criação rápida embutida).
export function ProcedimentoCombobox({
  value, onChange, options,
}: {
  value: string;
  onChange: (nome: string) => void;
  options: { id: string; nome: string }[];
}) {
  const create = useCreate("procedimentos");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const exists = options.some((p) => p.nome.toLowerCase() === search.trim().toLowerCase());

  const criar = async () => {
    const nome = search.trim();
    if (!nome) return;
    await create.mutateAsync({ nome });
    onChange(nome);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}>
          {value || "Procedimento..."}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar procedimento..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nenhum procedimento.</CommandEmpty>
            {search.trim() && !exists && (
              <CommandGroup>
                <CommandItem value={`__novo__${search}`} onSelect={criar}>
                  <Plus className="h-4 w-4" /> Criar "{search.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map((p) => (
                <CommandItem key={p.id} value={p.nome}
                  onSelect={(val) => { onChange(val); setSearch(""); setOpen(false); }}>
                  <Check className={cn("h-4 w-4", value === p.nome ? "opacity-100" : "opacity-0")} />
                  {p.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type ProcItem = { procedimento: string; valor: string };

type Atendimento = {
  id?: string;
  paciente: string;
  forma_pagamento: string;
  taxa: number | string;
  data: string;
  nota_fiscal: boolean;
  status_pagamento: string;
};

const empty = (): Atendimento => ({
  paciente: "", forma_pagamento: "",
  taxa: 0, data: todayISO(),
  nota_fiscal: false, status_pagamento: "pago",
});

export function AtendimentoForm({
  editing, onClose, onSaved, trigger, initialData,
}: {
  editing?: any;
  onClose?: () => void;
  onSaved?: () => void;
  trigger?: React.ReactNode;
  initialData?: { paciente?: string; valorEstimado?: number };
}) {
  const { user } = useAuth();
  const procedimentos = useTable<any>("procedimentos", "nome", true);
  const formas = useTable<any>("formas_pagamento", "nome", true);
  const atendimentos = useTable<any>("atendimentos", "data");
  const pacientes = useTable<any>("pacientes", "nome", true);
  const qc = useQueryClient();
  // Inserções feitas diretamente via supabase para controlar o toast de sucesso
  // (os hooks useCreate disparam um toast próprio em cada insert).
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Atendimento>(editing ? { ...editing } : empty());
  const [pacienteId, setPacienteId] = useState<string | null>(editing?.paciente_id ?? null);
  const [items, setItems] = useState<ProcItem[]>([{ procedimento: "", valor: "" }]);
  const [parcelado, setParcelado] = useState<boolean>(!!editing?.parcelado);
  const [parcelasN, setParcelasN] = useState<number>(editing?.parcelas_total > 1 ? editing.parcelas_total : 3);
  const [dividido, setDividido] = useState(false);
  const [valorInicial, setValorInicial] = useState("");
  const [formaInicial, setFormaInicial] = useState("");
  const [segundaAgora, setSegundaAgora] = useState(false);
  const [formaSegunda, setFormaSegunda] = useState("");
  const [formaInicialTocada, setFormaInicialTocada] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const [showMore, setShowMore] = useState(false);

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
    if (!open) return;
    if (editing) {
      setV({ ...editing });
    } else if (initialData) {
      setV({ ...empty(), paciente: initialData.paciente ?? "" });
    } else {
      setV(empty());
    }
    setPacienteId(editing?.paciente_id ?? null);
    setParcelado(!!editing?.parcelado);
    setParcelasN(editing?.parcelas_total > 1 ? editing.parcelas_total : 3);
    setDividido(false);
    setValorInicial("");
    setFormaInicial("");
    setFormaInicialTocada(false);
    setSegundaAgora(false);
    setFormaSegunda("");
    setShowMore(!!editing && (!!editing.parcelado || !!editing.nota_fiscal));
    if (editing?.id) {
      // Carrega itens existentes; fallback para o atendimento legado (1 linha).
      supabase
        .from("atendimento_procedimentos")
        .select("*")
        .eq("atendimento_id", editing.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setItems(data
              .sort((a: any, b: any) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
              .map((d: any) => ({ procedimento: d.procedimento, valor: String(d.valor ?? "") })));
          } else {
            setItems([{ procedimento: editing.procedimento ?? "", valor: String(editing.valor_bruto ?? "") }]);
          }
        });
    } else if (initialData) {
      setItems([{ procedimento: "", valor: initialData.valorEstimado ? String(initialData.valorEstimado) : "" }]);
    } else {
      setItems([{ procedimento: "", valor: "" }]);
    }
  }, [open, editing]);

  useEffect(() => {
    if (dividido && !formaInicialTocada) {
      setFormaInicial(v.forma_pagamento);
    }
  }, [v.forma_pagamento, dividido, formaInicialTocada]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending || saving;

  const onForma = (val: string) => {
    const f = (formas.data ?? []).find((x) => x.nome === val);
    setV((p) => ({ ...p, forma_pagamento: val, taxa: f?.taxa ?? p.taxa }));
  };

  const totalBruto = items.reduce((s, it) => s + Number(it.valor || 0), 0);
  const valorLiquido = Math.max(0, totalBruto * (1 - Number(v.taxa || 0) / 100));

  const setItem = (i: number, patch: Partial<ProcItem>) =>
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => [...arr, { procedimento: "", valor: "" }]);
  const removeItem = (i: number) => setItems((arr) => arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Trava síncrona: impede dois submits antes da atualização do estado React.
    if (submitLock.current) return;
    // Proteção visual baseada no estado React.
    if (saving) return;

    const validItems = items.filter((it) => it.procedimento.trim());
    if (validItems.length === 0) return toast.error("Adicione ao menos um procedimento");
    if (!v.forma_pagamento) return toast.error("Selecione a forma de pagamento");
    if (totalBruto <= 0) return toast.error("Informe o valor dos procedimentos");
    if (dividido) {
      if (!(Number(valorInicial) > 0)) return toast.error("Informe o valor já recebido");
      if (!formaInicial) return toast.error("Selecione a forma de pagamento da parte recebida");
      if (Number(valorInicial) > totalBruto) return toast.error("Valor recebido não pode ser maior que o total do atendimento");
      if (segundaAgora && !formaSegunda) return toast.error("Selecione a forma de pagamento da segunda parte");
    }

    const usarParcelas = parcelado && parcelasN > 1;
    const procedimentoTexto = validItems.map((it) => it.procedimento.trim()).join(", ");
    // Normaliza o nome: remove espaços nas pontas e colapsa espaços internos.
    const nome = v.paciente.replace(/\s+/g, " ").trim();
    const nomeKey = nome.toLowerCase();

    submitLock.current = true;
    setSaving(true);
    try {
      // Resolve o paciente_id definitivo ANTES de salvar o atendimento.
      let idResolvido = pacienteId;
      if (!idResolvido && nome) {
        // 1) Busca na lista já carregada usando o nome normalizado.
        const existente = (pacientes.data ?? []).find(
          (p) => (p.nome ?? "").replace(/\s+/g, " ").trim().toLowerCase() === nomeKey,
        );
        if (existente) {
          idResolvido = existente.id;
        } else {
          // 2) Confirmação pontual no banco antes de criar (evita falso "inexistente"
          //    quando a lista ainda não carregou ou houve erro de consulta).
          try {
            const { data: encontrados, error: buscaError } = await supabase
              .from("pacientes")
              .select("id, nome")
              .ilike("nome", nome);
            if (buscaError) throw buscaError;
            const match = (encontrados ?? []).find(
              (p: any) => (p.nome ?? "").replace(/\s+/g, " ").trim().toLowerCase() === nomeKey,
            );
            if (match) idResolvido = match.id;
          } catch (err) {
            console.error("[AtendimentoForm] Erro ao buscar paciente:", err);
            toast.error("Não foi possível verificar o paciente. Tente novamente.");
            return;
          }

          // 3) Cria o paciente apenas se nenhuma correspondência foi encontrada.
          if (!idResolvido) {
            let novo: any;
            try {
              novo = await createPaciente.mutateAsync({ nome });
            } catch (err) {
              console.error("[AtendimentoForm] Erro ao criar paciente:", err);
              toast.error("Não foi possível cadastrar o paciente. Tente novamente.");
              return;
            }
            idResolvido = novo?.id ?? null;
            if (!idResolvido) {
              console.error("[AtendimentoForm] Criação de paciente não retornou ID.");
              toast.error("Não foi possível cadastrar o paciente. Tente novamente.");
              return;
            }
          }
        }
      }


      const taxaInicial = Number((formas.data ?? []).find((x) => x.nome === formaInicial)?.taxa ?? 0);
      const taxaSegunda = Number((formas.data ?? []).find((x) => x.nome === formaSegunda)?.taxa ?? 0);
      const taxaEfetiva = dividido
        ? (segundaAgora
          ? (Number(valorInicial) * taxaInicial + (totalBruto - Number(valorInicial)) * taxaSegunda) / totalBruto
          : taxaInicial)
        : Number(v.taxa);

      const payload = {
        paciente: nome,
        paciente_id: idResolvido,
        procedimento: procedimentoTexto,
        forma_pagamento: v.forma_pagamento,
        valor_bruto: Number(totalBruto.toFixed(2)),
        taxa: Number(taxaEfetiva.toFixed(2)),
        valor_liquido: dividido ? Number((totalBruto * (1 - taxaEfetiva / 100)).toFixed(2)) : Number(valorLiquido.toFixed(2)),
        data: v.data,
        nota_fiscal: v.nota_fiscal,
        status_pagamento: usarParcelas || (dividido && !segundaAgora) ? "pendente" : v.status_pagamento,
        parcelado: dividido ? false : usarParcelas,
        parcelas_total: usarParcelas ? parcelasN : 1,
      };

      // Criação ou atualização do atendimento.
      let atendimentoId = editing?.id;
      try {
        if (isEdit) {
          await update.mutateAsync({ id: editing.id, values: payload });
        } else {
          const created = await create.mutateAsync(payload);
          atendimentoId = created?.id;
        }
      } catch (err) {
        console.error("[AtendimentoForm] Erro ao salvar o atendimento:", err);
        toast.error("Não foi possível salvar o atendimento. Tente novamente.");
        return;
      }

      if (atendimentoId) {
        // Exclusão dos procedimentos atuais do atendimento.
        const { error: delError } = await supabase
          .from("atendimento_procedimentos")
          .delete()
          .eq("atendimento_id", atendimentoId);
        if (delError) {
          console.error("[AtendimentoForm] Erro ao excluir procedimentos:", delError);
          toast.error("Não foi possível atualizar os procedimentos do atendimento. Tente novamente.");
          return;
        }
        // Inserção dos novos procedimentos.
        const rows = validItems.map((it) => ({
          user_id: user!.id,
          atendimento_id: atendimentoId,
          procedimento: it.procedimento.trim(),
          valor: Number(it.valor || 0),
        }));
        const { error: insError } = await supabase
          .from("atendimento_procedimentos")
          .insert(rows);
        if (insError) {
          console.error("[AtendimentoForm] Erro ao inserir procedimentos:", insError);
          toast.error("Não foi possível salvar os procedimentos do atendimento. Tente novamente.");
          return;
        }
      }

      // Criação dos recebimentos do modo dividido.
      if (!isEdit && dividido && atendimentoId) {
        try {
          await createRecebimento.mutateAsync({
            atendimento_id: atendimentoId,
            valor: Number(valorInicial),
            data: v.data,
            forma_pagamento: formaInicial,
            observacao: null,
            taxa: taxaInicial,
            valor_liquido: Number((Number(valorInicial) * (1 - taxaInicial / 100)).toFixed(2)),
          });
          if (segundaAgora) {
            await createRecebimento.mutateAsync({
              atendimento_id: atendimentoId,
              valor: Number((totalBruto - Number(valorInicial)).toFixed(2)),
              data: v.data,
              forma_pagamento: formaSegunda,
              observacao: null,
              taxa: taxaSegunda,
              valor_liquido: Number(((totalBruto - Number(valorInicial)) * (1 - taxaSegunda / 100)).toFixed(2)),
            });
          }
        } catch (err) {
          console.error("[AtendimentoForm] Erro ao registrar recebimento:", err);
          toast.error("Não foi possível registrar o recebimento inicial. Tente novamente.");
          return;
        }
      }

      // Todas as operações concluídas com sucesso.
      toast.success("Atendimento salvo com sucesso");
      onSaved?.();
      setOpen(false);
      onClose?.();
    } catch (err) {
      console.error("[AtendimentoForm] Erro inesperado ao salvar atendimento:", err);
      toast.error("Ocorreu um erro inesperado ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
      submitLock.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isEdit && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" /> Novo atendimento</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar atendimento" : "Novo atendimento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Paciente</Label>
              <PacienteCombobox value={v.paciente} onChange={(nome, id) => { setV((p) => ({ ...p, paciente: nome })); setPacienteId(id); }} />
            </div>

            {/* Procedimentos */}
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Procedimentos</Label>
                <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-primary" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <ProcedimentoCombobox
                        value={it.procedimento}
                        onChange={(nome) => setItem(i, { procedimento: nome })}
                        options={procedimentosOrdenados}
                      />
                    </div>
                    <Input
                      type="number" step="0.01" placeholder="0,00"
                      className="w-28"
                      value={it.valor}
                      onChange={(e) => setItem(i, { valor: e.target.value })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(i)} disabled={items.length === 1} aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Valor total bruto</span>
                <span className="font-semibold">{brl(totalBruto)}</span>
              </div>
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
              <Label>Valor líquido</Label>
              <div className="h-9 px-3 rounded-md border bg-muted/30 flex items-center text-sm font-medium">{brl(valorLiquido)}</div>
            </div>

            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              className="sm:col-span-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors self-start -mt-1"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
              {showMore ? "Menos opções" : "Mais opções"}
            </button>

            {showMore && (
            <>
            <div className="sm:col-span-2 rounded-lg bg-muted/40 p-3 space-y-3">
              <Label className="flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" /> Forma de recebimento
              </Label>
              <div className="inline-flex rounded-lg border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => { setParcelado(false); setDividido(false); }}
                  disabled={isEdit && !!editing?.parcelado}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-md transition-colors",
                    !parcelado && !dividido ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  À vista
                </button>
                <button
                  type="button"
                  onClick={() => { setParcelado(true); setDividido(false); }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors",
                    parcelado ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Parcelado
                </button>
                <button
                  type="button"
                  onClick={() => { setDividido(true); setParcelado(false); if (!formaInicialTocada) setFormaInicial(v.forma_pagamento); }}
                  disabled={isEdit}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors",
                    dividido ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    isEdit && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Split className="h-3.5 w-3.5" /> Dividido
                </button>
              </div>


              {dividido ? (
                <div className="rounded-lg bg-muted/40 p-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {segundaAgora
                      ? "As duas partes serão registradas agora. O atendimento já fica quitado."
                      : "Registre o valor já recebido agora. O restante fica pendente para receber depois, em Contas a Receber."}
                  </p>
                  <div className="space-y-1.5">
                    <Label>Valor recebido agora (R$)</Label>
                    <Input
                      type="number" step="0.01" placeholder="0,00"
                      value={valorInicial}
                      onChange={(e) => setValorInicial(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Forma de pagamento (desta parte)</Label>
                    <Select value={formaInicial} onValueChange={(val) => { setFormaInicial(val); setFormaInicialTocada(true); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {(formas.data ?? []).map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome} ({p.taxa}%)</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Restante: {brl(totalBruto - Number(valorInicial || 0))}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <Label className="cursor-pointer text-xs">A segunda parte também foi paga agora?</Label>
                    <Switch
                      checked={segundaAgora}
                      onCheckedChange={(c) => setSegundaAgora(c)}
                    />
                  </div>
                  {segundaAgora && (
                    <div className="space-y-1.5">
                      <Label>Forma de pagamento (segunda parte)</Label>
                      <div className="flex items-center gap-2">
                        <Select value={formaSegunda} onValueChange={setFormaSegunda}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {(formas.data ?? []).map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome} ({p.taxa}%)</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Valor: {brl(totalBruto - Number(valorInicial || 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : parcelado ? (
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
            </>
            )}
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
