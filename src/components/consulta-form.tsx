import { useEffect, useState } from "react";
import { useCreate, useUpdate, useTable } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { todayISO } from "@/lib/format";
import { resolvePacienteId } from "@/lib/pacientes";
import { PacienteCombobox } from "@/components/atendimento-form";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

type Consulta = {
  id?: string;
  paciente: string;
  paciente_id?: string | null;
  data_prevista: string;
  valor_estimado: number | string;
  observacao: string;
};

const empty = (): Consulta => ({
  paciente: "",
  data_prevista: todayISO(),
  valor_estimado: "",
  observacao: "",
});

export function ConsultaForm({
  editing,
  onClose,
  trigger,
}: {
  editing?: any;
  onClose?: () => void;
  trigger?: React.ReactNode;
}) {
  const create = useCreate("consultas_previstas");
  const update = useUpdate("consultas_previstas");
  const pacientes = useTable<any>("pacientes", "nome", true);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Consulta>(editing ? { ...editing } : empty());
  // Guarda o id vindo do combobox quando um paciente existente é selecionado.
  const [pacienteId, setPacienteId] = useState<string | null>(editing?.paciente_id ?? null);

  useEffect(() => {
    if (open) {
      setV(editing ? { ...editing } : empty());
      setPacienteId(editing?.paciente_id ?? null);
    }
  }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.paciente.trim()) return toast.error("Informe o paciente");
    if (!v.data_prevista) return toast.error("Informe a data prevista");

    // Resolve/crie o paciente_id preservando o texto do nome para compatibilidade.
    let idResolvido: string | null = pacienteId;
    try {
      idResolvido = await resolvePacienteId({
        nome: v.paciente,
        userId: user!.id,
        knownId: pacienteId,
        cache: pacientes.data ?? [],
      });
    } catch (err) {
      console.error("[ConsultaForm] Erro ao resolver paciente:", err);
      toast.error("Não foi possível vincular o paciente. Tente novamente.");
      return;
    }

    const payload = {
      paciente: v.paciente.trim(),
      paciente_id: idResolvido,
      data_prevista: v.data_prevista,
      valor_estimado: Number(v.valor_estimado || 0),
      observacao: v.observacao.trim() || null,
    };

    if (isEdit) await update.mutateAsync({ id: editing.id, values: payload });
    else await create.mutateAsync(payload);

    qc.invalidateQueries({ queryKey: ["pacientes"] });
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose?.();
      }}
    >
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Nova consulta
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar consulta" : "Nova consulta prevista"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            <PacienteCombobox
              value={v.paciente}
              onChange={(nome, id) => {
                setV((p) => ({ ...p, paciente: nome }));
                setPacienteId(id);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data prevista</Label>
              <Input
                type="date"
                required
                value={v.data_prevista}
                onChange={(e) => setV({ ...v, data_prevista: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor estimado (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="opcional"
                value={v.valor_estimado}
                onChange={(e) => setV({ ...v, valor_estimado: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação (opcional)</Label>
            <Textarea
              rows={2}
              value={v.observacao}
              onChange={(e) => setV({ ...v, observacao: e.target.value })}
              placeholder="Ex.: retorno, avaliação..."
            />
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
