import { useEffect, useState } from "react";
import { useCreate, useTable, useUpdate } from "@/hooks/use-data";
import { formatDateBR } from "@/lib/format";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

const NONE = "__none__";

type Custo = {
  id?: string;
  laboratorio: string;
  tipo_trabalho: string;
  paciente: string;
  procedimento: string;
  atendimento_id: string | null;
  valor: number | string;
  data: string;
};

const empty = (): Custo => ({
  laboratorio: "", tipo_trabalho: "", paciente: "", procedimento: "",
  atendimento_id: null, valor: "", data: new Date().toISOString().slice(0, 10),
});

export function CustoLabForm({
  editing, onClose,
}: {
  editing?: any;
  onClose?: () => void;
}) {
  const labs = useTable<any>("laboratorios", "nome", true);
  const tipos = useTable<any>("tipos_trabalho", "nome", true);
  const atendimentos = useTable<any>("atendimentos", "data");
  const create = useCreate("custos_laboratorio");
  const update = useUpdate("custos_laboratorio");

  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Custo>(editing ? { ...editing } : empty());

  useEffect(() => {
    if (open) setV(editing ? { ...editing } : empty());
  }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const onAtendimento = (id: string) => {
    if (id === NONE) {
      setV((p) => ({ ...p, atendimento_id: null }));
      return;
    }
    const a = (atendimentos.data ?? []).find((x: any) => x.id === id);
    setV((p) => ({
      ...p,
      atendimento_id: id,
      paciente: a?.paciente ?? p.paciente,
      procedimento: a?.procedimento ?? p.procedimento,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.laboratorio) return toast.error("Selecione o laboratório");
    if (!v.tipo_trabalho) return toast.error("Selecione o tipo de trabalho");
    if (!Number(v.valor)) return toast.error("Informe o valor");

    const payload = {
      laboratorio: v.laboratorio,
      tipo_trabalho: v.tipo_trabalho,
      paciente: v.paciente.trim(),
      procedimento: v.procedimento?.trim() || null,
      atendimento_id: v.atendimento_id || null,
      valor: Number(v.valor),
      data: v.data,
    };
    if (isEdit) await update.mutateAsync({ id: editing.id, values: payload });
    else await create.mutateAsync(payload);

    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" /> Novo custo</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar custo" : "Novo custo de laboratório"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Laboratório</Label>
              <Select value={v.laboratorio} onValueChange={(x) => setV({ ...v, laboratorio: x })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(labs.data ?? []).map((l: any) => <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de trabalho</Label>
              <Select value={v.tipo_trabalho} onValueChange={(x) => setV({ ...v, tipo_trabalho: x })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(tipos.data ?? []).map((l: any) => <SelectItem key={l.id} value={l.nome}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vincular ao atendimento (opcional)</Label>
              <Select value={v.atendimento_id ?? NONE} onValueChange={onAtendimento}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {(atendimentos.data ?? []).slice(0, 100).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {formatDateBR(a.data)} · {a.paciente} · {a.procedimento}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Input required value={v.paciente} onChange={(e) => setV({ ...v, paciente: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Procedimento</Label>
              <Input value={v.procedimento} onChange={(e) => setV({ ...v, procedimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" required value={v.valor}
                onChange={(e) => setV({ ...v, valor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
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

export function EditCustoButton({ row }: { row: any }) {
  const [editing, setEditing] = useState<any | null>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(row)}>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      {editing && <CustoLabForm editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
