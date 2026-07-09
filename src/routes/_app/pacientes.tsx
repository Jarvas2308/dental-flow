import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { buildPacienteHistoryCounter } from "@/lib/pacientes";
import {
  dadosDoPaciente,
  type AtendimentoFull,
  type ConsultaFull,
  type PropostaFull,
  type TentativaFull,
  type EventoTipo,
} from "@/lib/paciente-detalhe";
import type { RecebimentoRow, ParcelaRow } from "@/lib/finance";
import { brl, formatDateBR } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
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
import {
  Plus,
  Pencil,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Stethoscope,
  Wallet,
  CalendarClock,
  ClipboardList,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
type PacienteRow = Tables<"pacientes">;

export const Route = createFileRoute("/_app/pacientes")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: Pacientes,
});

function PacienteForm({
  pacientes,
  editing,
  onClose,
}: {
  pacientes: PacienteRow[];
  editing?: PacienteRow;
  onClose?: () => void;
}) {
  const create = useCreate("pacientes");
  const update = useUpdate("pacientes");
  const [open, setOpen] = useState(!!editing);
  const [nome, setNome] = useState(editing?.nome ?? "");

  useEffect(() => {
    if (open) setNome(editing?.nome ?? "");
  }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) return toast.error("Informe o nome");
    const dup = pacientes.some(
      (p) => p.nome?.toLowerCase() === nomeTrim.toLowerCase() && (!isEdit || p.id !== editing.id),
    );
    if (dup) return toast.error("Já existe um paciente com esse nome");
    if (isEdit) await update.mutateAsync({ id: editing.id, values: { nome: nomeTrim } });
    else await create.mutateAsync({ nome: nomeTrim });
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
            <Plus className="h-4 w-4" /> Novo paciente
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar paciente" : "Cadastrar paciente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
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

const EVENTO_META: Record<EventoTipo, { label: string; icon: typeof Stethoscope; cls: string }> = {
  atendimento: { label: "Atendimento", icon: Stethoscope, cls: "text-primary" },
  recebimento: { label: "Recebimento", icon: Wallet, cls: "text-success" },
  consulta: { label: "Consulta", icon: CalendarClock, cls: "text-foreground" },
  proposta: { label: "Proposta", icon: ClipboardList, cls: "text-warning" },
  tentativa: { label: "Contato", icon: PhoneCall, cls: "text-muted-foreground" },
};

function PacienteDetalhe({
  paciente,
  sources,
}: {
  paciente: PacienteRow;
  sources: {
    atendimentos: AtendimentoFull[];
    recebimentos: RecebimentoRow[];
    parcelas: ParcelaRow[];
    consultas: ConsultaFull[];
    propostas: PropostaFull[];
    tentativas: TentativaFull[];
  };
}) {
  const { resumo, historico } = useMemo(
    () =>
      dadosDoPaciente(paciente, {
        atendimentos: sources.atendimentos,
        recebimentos: sources.recebimentos,
        parcelas: sources.parcelas,
        consultas: sources.consultas,
        propostas: sources.propostas,
        tentativas: sources.tentativas,
      }),
    [paciente, sources],
  );

  return (
    <div className="space-y-4 p-4 bg-muted/30">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Atendimentos"
          value={String(resumo.totalAtendimentos)}
          icon={<Stethoscope className="h-4 w-4" />}
        />
        <StatCard
          label="Recebido"
          value={brl(resumo.totalRecebido)}
          tone="success"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Em aberto"
          value={brl(resumo.totalEmAberto)}
          tone={resumo.totalEmAberto > 0 ? "destructive" : "default"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          label="Consultas futuras"
          value={String(resumo.consultasFuturas)}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Follow-ups abertos"
          value={String(resumo.followupsEmAberto)}
          tone={resumo.followupsEmAberto > 0 ? "warning" : "default"}
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-2xl border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
        <div className="border-b px-4 py-3 text-sm font-medium">Histórico cronológico</div>
        {historico.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum registro para este paciente ainda.
          </div>
        ) : (
          <ul className="divide-y">
            {historico.map((ev) => {
              const meta = EVENTO_META[ev.tipo];
              const Icon = meta.icon;
              return (
                <li key={ev.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn("shrink-0", meta.cls)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{ev.titulo}</span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {meta.label}
                      </Badge>
                    </div>
                    {ev.detalhe && (
                      <div className="truncate text-xs text-muted-foreground">{ev.detalhe}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {ev.valor != null && (
                      <div className="text-sm font-medium tabular-nums">{brl(ev.valor)}</div>
                    )}
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatDateBR(ev.data)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Pacientes() {
  const list = useTable<PacienteRow>("pacientes", "nome", true);
  const atendimentos = useTable<AtendimentoFull>("atendimentos", "data");
  const recebimentos = useTable<RecebimentoRow>("recebimentos", "data");
  const parcelas = useTable<ParcelaRow>("parcelas", "vencimento");
  const consultas = useTable<ConsultaFull>("consultas_previstas", "data_prevista");
  const propostas = useTable<PropostaFull>("tratamentos_propostos", "data_proposta");
  const tentativas = useTable<TentativaFull>("tentativas_contato", "data");
  const del = useDelete("pacientes");
  const { q: qParam } = Route.useSearch();
  const [editing, setEditing] = useState<PacienteRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [q, setQ] = useState(qParam ?? "");

  // Ao chegar via "Ver paciente" (com ?q=), sincroniza a busca e já expande
  // automaticamente o paciente correspondente para agilizar a navegação.
  useEffect(() => {
    if (qParam) setQ(qParam);
  }, [qParam]);

  const pacientes = useMemo(() => list.data ?? [], [list.data]);

  // Histórico completo do paciente: atendimentos + consultas + propostas/follow-ups.
  // Prioriza paciente_id e usa o nome normalizado apenas como fallback para
  // registros antigos sem id, sem duplicar registros que já têm paciente_id.
  const countFor = useMemo(
    () => buildPacienteHistoryCounter([atendimentos.data, consultas.data, propostas.data]),
    [atendimentos.data, consultas.data, propostas.data],
  );

  const sources = useMemo(
    () => ({
      atendimentos: atendimentos.data ?? [],
      recebimentos: recebimentos.data ?? [],
      parcelas: parcelas.data ?? [],
      consultas: consultas.data ?? [],
      propostas: propostas.data ?? [],
      tentativas: tentativas.data ?? [],
    }),
    [
      atendimentos.data,
      recebimentos.data,
      parcelas.data,
      consultas.data,
      propostas.data,
      tentativas.data,
    ],
  );

  const rows = useMemo(
    () => pacientes.filter((p) => !q || p.nome?.toLowerCase().includes(q.toLowerCase())),
    [pacientes, q],
  );

  // Expande automaticamente quando a busca resolve para um único paciente
  // (fluxo "Ver paciente"), sem interferir na navegação manual.
  useEffect(() => {
    if (qParam && rows.length === 1) setExpanded(rows[0].id);
  }, [qParam, rows]);

  return (
    <>
      <PageHeader
        title="Pacientes"
        description="Cadastro, histórico e pendências de cada paciente"
        actions={<PacienteForm pacientes={pacientes} />}
      />

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-12">
                  Nenhum paciente ainda.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const isOpen = expanded === r.id;
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
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.nome}
                        <Badge variant="secondary">{countFor(r)} reg.</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Editar"
                          onClick={() => setEditing(r)}
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <ConfirmDelete
                          title="Excluir paciente?"
                          description={`"${r.nome}" será removido permanentemente.`}
                          onConfirm={() => del.mutate(r.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow key={`${r.id}-detail`} className="hover:bg-transparent">
                      <TableCell colSpan={3} className="p-0">
                        <PacienteDetalhe paciente={r} sources={sources} />
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
        <PacienteForm pacientes={pacientes} editing={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
