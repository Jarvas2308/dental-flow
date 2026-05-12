import { useEffect, useMemo, useState } from "react";
import { useCreate, useTable, useUpdate } from "@/hooks/use-data";
import { brl } from "@/lib/format";
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
import { Check, ChevronsUpDown, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

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
};

const empty = (): Atendimento => ({
  paciente: "", procedimento: "", forma_pagamento: "",
  valor_bruto: "", taxa: 0, data: new Date().toISOString().slice(0, 10),
  nota_fiscal: false,
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
  const create = useCreate("atendimentos");
  const update = useUpdate("atendimentos");
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Atendimento>(editing ? { ...editing } : empty());

  useEffect(() => {
    if (open) setV(editing ? { ...editing } : empty());
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

    const payload = {
      paciente: v.paciente.trim(),
      procedimento: v.procedimento,
      forma_pagamento: v.forma_pagamento,
      valor_bruto: Number(v.valor_bruto),
      taxa: Number(v.taxa),
      valor_liquido: Number(valorLiquido.toFixed(2)),
      data: v.data,
      nota_fiscal: v.nota_fiscal,
    };

    if (isEdit) await update.mutateAsync({ id: editing.id, values: payload });
    else await create.mutateAsync(payload);

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
              <Label>Procedimento</Label>
              <Select value={v.procedimento} onValueChange={(val) => setV({ ...v, procedimento: val })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(procedimentos.data ?? []).map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
                  {(procedimentos.data ?? []).length === 0 && <div className="p-3 text-xs text-muted-foreground">Cadastre em Cadastros</div>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
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
