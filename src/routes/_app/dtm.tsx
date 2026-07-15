import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth-context";
import { PacienteCombobox } from "@/components/atendimento-form";
import { resolvePacienteId } from "@/lib/pacientes";
import { formatDateBR, todayISO } from "@/lib/format";
import { sortDtmAcompanhamentos } from "@/lib/dtm";
import { PageHeader, EmptyState, AlertBanner } from "@/components/ui-kit";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Pencil,
  Loader2,
  ChevronDown,
  ChevronRight,
  Activity,
  CheckCircle2,
  CalendarPlus,
} from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type DtmAcompanhamentoRow = Tables<"dtm_acompanhamentos">;
export type DtmConsultaRow = Tables<"dtm_consultas">;
type PacienteRow = Tables<"pacientes">;

export const Route = createFileRoute("/_app/dtm")({
  component: DtmPage,
});

// Contagem de consultas realizadas por acompanhamento.
function contarPorAcomp(consultas: DtmConsultaRow[]): Map<string, DtmConsultaRow[]> {
  const m = new Map<string, DtmConsultaRow[]>();
  for (const c of consultas) {
    const list = m.get(c.acompanhamento_id) ?? [];
    list.push(c);
    m.set(c.acompanhamento_id, list);
  }
  for (const [k, list] of m) {
    list.sort((a, b) => a.numero - b.numero);
    m.set(k, list);
  }
  return m;
}

function AcompanhamentoForm({
  editing,
  onClose,
  minTotal,
}: {
  editing?: DtmAcompanhamentoRow;
  onClose?: () => void;
  minTotal?: number;
}) {
  const pacientes = useTable<PacienteRow>("pacientes", "nome", true);
  const create = useCreate("dtm_acompanhamentos");
  const update = useUpdate("dtm_acompanhamentos");
  const { user } = useAuth();
  const [open, setOpen] = useState(!!editing);
  const [paciente, setPaciente] = useState(editing?.paciente ?? "");
  const [pacienteId, setPacienteId] = useState<string | null>(editing?.paciente_id ?? null);
  const [total, setTotal] = useState<string>(editing ? String(editing.total_consultas) : "");
  const [dataInicio, setDataInicio] = useState<string>(editing?.data_inicio ?? todayISO());

  useEffect(() => {
    if (open) {
      setPaciente(editing?.paciente ?? "");
      setPacienteId(editing?.paciente_id ?? null);
      setTotal(editing ? String(editing.total_consultas) : "");
      setDataInicio(editing?.data_inicio ?? todayISO());
    }
  }, [open, editing]);

  const busy = create.isPending || update.isPending;
  const isEdit = !!editing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = paciente.trim();
    const totalNum = Number(total);
    if (!nome) return toast.error("Informe o paciente");
    if (!totalNum || totalNum <= 0) return toast.error("Total de consultas deve ser > 0");
    if (isEdit && minTotal != null && totalNum < minTotal) {
      return toast.error(`Total não pode ser menor que ${minTotal} (já realizadas)`);
    }

    let pid = pacienteId;
    try {
      pid = await resolvePacienteId({
        nome,
        userId: user!.id,
        knownId: pacienteId ?? undefined,
        cache: pacientes.data ?? [],
      });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Erro ao vincular paciente");
    }

    const values = {
      paciente: nome,
      paciente_id: pid,
      total_consultas: totalNum,
      data_inicio: dataInicio || null,
    };

    if (isEdit) await update.mutateAsync({ id: editing.id, values });
    else await create.mutateAsync(values);
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
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Novo acompanhamento
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar acompanhamento DTM" : "Novo acompanhamento DTM"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            <PacienteCombobox
              value={paciente}
              onChange={(nome, id) => {
                setPaciente(nome);
                setPacienteId(id);
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total de consultas</Label>
              <Input
                type="number"
                min={1}
                required
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RegistrarConsultaButton({
  acomp,
  proximoNumero,
  disabled,
}: {
  acomp: DtmAcompanhamentoRow;
  proximoNumero: number;
  disabled?: boolean;
}) {
  const create = useCreate("dtm_consultas");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(todayISO());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return toast.error("Todas as consultas já foram realizadas");
    if (!data) return toast.error("Informe a data");
    await create.mutateAsync({
      acompanhamento_id: acomp.id,
      numero: proximoNumero,
      data_realizada: data,
    });
    setOpen(false);
    setData(todayISO());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <CalendarPlus className="h-4 w-4" /> Registrar consulta realizada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar consulta #{proximoNumero}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Data realizada</Label>
            <Input type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </div>
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

function AcompDetalhe({
  acomp,
  consultas,
}: {
  acomp: DtmAcompanhamentoRow;
  consultas: DtmConsultaRow[];
}) {
  const update = useUpdate("dtm_acompanhamentos");
  const delConsulta = useDelete("dtm_consultas");
  const realizadas = consultas.length;
  const total = acomp.total_consultas;
  const faltantes = Math.max(total - realizadas, 0);
  const proximoNumero = realizadas + 1;
  const completou = realizadas >= total;
  const emAcompanhamento = acomp.status === "em_acompanhamento";

  const concluir = async () => {
    await update.mutateAsync({ id: acomp.id, values: { status: "concluido" } });
    toast.success("Acompanhamento concluído");
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30">
      {completou && emAcompanhamento && (
        <AlertBanner
          tone="primary"
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Todas as consultas foram realizadas"
          description="Deseja concluir este acompanhamento?"
          action={
            <Button size="sm" onClick={concluir} disabled={update.isPending}>
              Concluir acompanhamento
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-semibold">{total}</div>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">Realizadas</div>
          <div className="text-lg font-semibold">{realizadas}</div>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">Faltantes</div>
          <div className="text-lg font-semibold">{faltantes}</div>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="text-lg font-semibold capitalize">
            {acomp.status === "concluido" ? "Concluído" : "Em acompanhamento"}
          </div>
        </div>
      </div>

      <Progress value={total > 0 ? Math.min(100, (realizadas / total) * 100) : 0} />

      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Consultas realizadas</div>
        {emAcompanhamento && (
          <RegistrarConsultaButton
            acomp={acomp}
            proximoNumero={proximoNumero}
            disabled={completou}
          />
        )}
      </div>

      {consultas.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-6 w-6" />}
          title="Nenhuma consulta registrada"
          description="Registre a primeira consulta realizada para iniciar o progresso."
        />
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.numero}</TableCell>
                  <TableCell>{formatDateBR(c.data_realizada)}</TableCell>
                  <TableCell className="text-right">
                    <ConfirmDelete
                      title="Excluir consulta?"
                      description={`A consulta #${c.numero} será removida.`}
                      onConfirm={() => delConsulta.mutate(c.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function DtmPage() {
  const list = useTable<DtmAcompanhamentoRow>("dtm_acompanhamentos", "data_inicio", true);
  const consultas = useTable<DtmConsultaRow>("dtm_consultas", "numero", true);
  const del = useDelete("dtm_acompanhamentos");
  const [editing, setEditing] = useState<DtmAcompanhamentoRow | null>(null);
  const [editingMin, setEditingMin] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const porAcomp = useMemo(() => contarPorAcomp(consultas.data ?? []), [consultas.data]);
  // Ordenação canônica por data_inicio ASC (nulos ao final), independente do
  // que o backend devolveu, garantindo consistência entre telas.
  const rows = useMemo(() => sortDtmAcompanhamentos(list.data ?? []), [list.data]);


  return (
    <>
      <PageHeader
        title="Acompanhamento DTM"
        description="Controle operacional das consultas de tratamentos DTM já pagos"
        actions={<AcompanhamentoForm />}
      />

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Paciente</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Faltantes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Última realizada</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<Activity className="h-6 w-6" />}
                    title="Nenhum acompanhamento DTM ainda"
                    description="Crie um acompanhamento para controlar as consultas de tratamentos DTM já pagos."
                  />
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const isOpen = expanded === r.id;
              const cs = porAcomp.get(r.id) ?? [];
              const realizadas = cs.length;
              const faltantes = Math.max(r.total_consultas - realizadas, 0);
              const ultima = cs[cs.length - 1]?.data_realizada;
              return (
                <Fragment key={r.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isOpen ? "Recolher" : "Expandir"}
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(isOpen ? null : r.id);
                        }}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">{r.paciente}</TableCell>
                    <TableCell>
                      {realizadas}/{r.total_consultas}
                    </TableCell>
                    <TableCell>{faltantes}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "concluido" ? "secondary" : "default"}>
                        {r.status === "concluido" ? "Concluído" : "Em acompanhamento"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.data_inicio ? formatDateBR(r.data_inicio) : "—"}</TableCell>
                    <TableCell>{ultima ? formatDateBR(ultima) : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => {
                            setEditingMin(realizadas);
                            setEditing(r);
                          }}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <ConfirmDelete
                          title="Excluir acompanhamento?"
                          description={`"${r.paciente}" e todas as consultas relacionadas serão removidos.`}
                          onConfirm={() => del.mutate(r.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`${r.id}-detail`} className="hover:bg-transparent">
                      <TableCell colSpan={8} className="p-0">
                        <AcompDetalhe acomp={r} consultas={cs} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <AcompanhamentoForm
          editing={editing}
          minTotal={editingMin}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
