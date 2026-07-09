import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import type { Database } from "@/integrations/supabase/types";

type ConsultaRow = Database["public"]["Tables"]["consultas_previstas"]["Row"];
import { useTable, useUpdate, useDelete } from "@/hooks/use-data";
import { brl, formatDateBR, parseLocalDate, todayISO } from "@/lib/format";
import { PageHeader, StatCard, AlertBanner, EmptyState } from "@/components/ui-kit";
import { VerPacienteButton } from "@/components/paciente-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDelete } from "@/components/confirm-delete";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { ConsultaForm } from "@/components/consulta-form";
import { AtendimentoForm } from "@/components/atendimento-form";
import {
  CalendarDays,
  CalendarClock,
  CircleDollarSign,
  Search,
  Loader2,
  CheckCircle2,
  Pencil,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/consultas")({
  component: Consultas,
});

function startOfWeek(d: Date) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function endOfWeek(d: Date) {
  const dt = startOfWeek(d);
  dt.setDate(dt.getDate() + 6);
  dt.setHours(23, 59, 59, 999);
  return dt;
}

function Consultas() {
  const [q, setQ] = useState("");
  const [showRealizadas, setShowRealizadas] = useState(false);
  const list = useTable<ConsultaRow>("consultas_previstas", "data_prevista", true);
  const upd = useUpdate("consultas_previstas");
  const del = useDelete("consultas_previstas");

  const all = useMemo(() => list.data ?? [], [list.data]);

  const { hoje, semana, valorSemana } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = todayISO();
    const ws = startOfWeek(today);
    const we = endOfWeek(today);
    const ativos = all.filter((c) => !c.realizada);
    const hoje = ativos.filter((c) => c.data_prevista === todayKey).length;
    const naSemana = ativos.filter((c) => {
      const d = parseLocalDate(c.data_prevista);
      return d && d >= ws && d <= we;
    });
    const valorSemana = naSemana.reduce((s, c) => s + Number(c.valor_estimado || 0), 0);
    return { hoje, semana: naSemana.length, valorSemana };
  }, [all]);

  const rows = useMemo(() => {
    let r = [...all];
    if (!showRealizadas) r = r.filter((c) => !c.realizada);
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((c) => (c.paciente ?? "").toLowerCase().includes(s));
    }
    return r.sort((a, b) => (a.data_prevista ?? "").localeCompare(b.data_prevista ?? ""));
  }, [all, q, showRealizadas]);

  const pag = usePagination(rows, 20, `${q}|${showRealizadas}`);

  const todayKey = todayISO();

  return (
    <>
      <PageHeader
        title="Consultas Previstas"
        description="Previsão simples de atendimentos futuros"
        actions={<ConsultaForm />}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard
          label="Consultas hoje"
          value={String(hoje)}
          tone="primary"
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <StatCard
          label="Consultas na semana"
          value={String(semana)}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Valor previsto da semana"
          value={brl(valorSemana)}
          tone="success"
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showRealizadas ? "default" : "outline"}
          onClick={() => setShowRealizadas((s) => !s)}
        >
          {showRealizadas ? "Ocultar realizadas" : "Mostrar realizadas"}
        </Button>
      </div>

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data prevista</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="text-right">Valor estimado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Nenhuma consulta prevista.
                </TableCell>
              </TableRow>
            )}
            {pag.pageItems.map((c) => {
              const atrasada = !c.realizada && c.data_prevista < todayKey;
              return (
                <TableRow key={c.id} className={cn(c.realizada && "opacity-60")}>
                  <TableCell
                    className={cn("text-muted-foreground", atrasada && "text-destructive")}
                  >
                    {formatDateBR(c.data_prevista)}
                  </TableCell>
                  <TableCell className="font-medium">{c.paciente}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[220px] truncate">
                    {c.observacao || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {Number(c.valor_estimado) > 0 ? brl(c.valor_estimado) : "—"}
                  </TableCell>
                  <TableCell>
                    {c.realizada ? (
                      <Badge className="bg-success text-success-foreground hover:bg-success/90 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Realizada
                      </Badge>
                    ) : atrasada ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 bg-destructive/10 text-destructive gap-1"
                      >
                        <Clock className="h-3 w-3" /> Atrasada
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-primary/40 bg-primary/10 text-primary gap-1"
                      >
                        <CalendarClock className="h-3 w-3" /> Prevista
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!c.realizada && <RealizarConsulta consulta={c} upd={upd} />}
                      {c.realizada && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground"
                          onClick={() => upd.mutate({ id: c.id, values: { realizada: false } })}
                        >
                          Reabrir
                        </Button>
                      )}
                      <EditConsultaButton row={c} />
                      <ConfirmDelete onConfirm={() => del.mutate(c.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          page={pag.page}
          totalPages={pag.totalPages}
          from={pag.from}
          to={pag.to}
          total={pag.total}
          canPrev={pag.canPrev}
          canNext={pag.canNext}
          onPrev={pag.prev}
          onNext={pag.next}
          unitLabel="consultas"
        />
      </div>
    </>
  );
}

function RealizarConsulta({
  consulta,
  upd,
}: {
  consulta: ConsultaRow;
  upd: ReturnType<typeof useUpdate>;
}) {
  // Garante que a consulta seja marcada como realizada uma única vez, mesmo
  // com cliques repetidos. Em caso de falha, libera para nova tentativa.
  const done = useRef(false);
  return (
    <AtendimentoForm
      initialData={{
        paciente: consulta.paciente,
        valorEstimado: Number(consulta.valor_estimado) || undefined,
      }}
      onSaved={async () => {
        if (done.current) return;
        done.current = true;
        try {
          // Marca a consulta como realizada e aguarda a confirmação antes de
          // encerrar o fluxo. Em caso de falha, a consulta permanece como não
          // realizada e o modal permanece aberto para nova tentativa.
          await upd.mutateAsync({ id: consulta.id, values: { realizada: true } });
        } catch (e) {
          done.current = false;
          throw e;
        }
      }}
      trigger={
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-success hover:bg-success/10">
          <CheckCircle2 className="h-4 w-4" /> Realizada
        </Button>
      }
    />
  );
}

function EditConsultaButton({ row }: { row: ConsultaRow }) {
  const [editing, setEditing] = useState<ConsultaRow | null>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(row)}>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      {editing && (
        <ConsultaForm
          editing={{
            id: editing.id,
            paciente: editing.paciente,
            paciente_id: editing.paciente_id,
            data_prevista: editing.data_prevista,
            valor_estimado: editing.valor_estimado,
            observacao: editing.observacao ?? "",
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
