import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { usePacienteDetalhe } from "@/hooks/use-data";
import {
  dadosDoPaciente,
  pertenceAoPaciente,
  type AtendimentoFull,
  type ConsultaFull,
  type PropostaFull,
  type TentativaFull,
  type EventoTipo,
} from "@/lib/paciente-detalhe";
import {
  resumoAtendimento,
  MONETARY_EPSILON,
  type RecebimentoRow,
  type ParcelaRow,
} from "@/lib/finance";
import { brl, formatDateBR } from "@/lib/format";
import { sortDtmAcompanhamentos } from "@/lib/dtm";
import { PageHeader, StatCard, EmptyState } from "@/components/ui-kit";
import { AtendimentoForm } from "@/components/atendimento-form";
import { ConsultaForm } from "@/components/consulta-form";
import { RegistrarRecebimento } from "@/components/recebimento-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  ArrowLeft,
  UserX,
  Stethoscope,
  Wallet,
  CalendarClock,
  ClipboardList,
  PhoneCall,
  Activity,
  HandCoins,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pacientes/$id")({
  component: PacienteDetalhePage,
});

const EVENTO_META: Record<EventoTipo, { label: string; icon: typeof Stethoscope; cls: string }> = {
  atendimento: { label: "Atendimento", icon: Stethoscope, cls: "text-primary" },
  recebimento: { label: "Recebimento", icon: Wallet, cls: "text-success" },
  consulta: { label: "Consulta", icon: CalendarClock, cls: "text-foreground" },
  proposta: { label: "Proposta", icon: ClipboardList, cls: "text-warning" },
  tentativa: { label: "Contato", icon: PhoneCall, cls: "text-muted-foreground" },
};

function PacienteDetalhePage() {
  const { id } = Route.useParams();
  const consulta = usePacienteDetalhe(id);
  const dados = consulta.data;
  const paciente = dados?.paciente ?? null;

  const { resumo, historico } = useMemo(() => {
    if (!dados || !paciente) {
      return {
        resumo: {
          totalAtendimentos: 0,
          totalRecebido: 0,
          totalEmAberto: 0,
          consultasFuturas: 0,
          followupsEmAberto: 0,
        },
        historico: [],
      };
    }
    return dadosDoPaciente(paciente, {
      atendimentos: dados.atendimentos as AtendimentoFull[],
      recebimentos: dados.recebimentos,
      parcelas: dados.parcelas,
      consultas: dados.consultas as ConsultaFull[],
      propostas: dados.propostas as PropostaFull[],
      tentativas: dados.tentativas as TentativaFull[],
    });
  }, [dados, paciente]);

  // Atendimentos que ainda têm saldo — cada um ganha seu próprio botão de
  // receber, porque RegistrarRecebimento é por atendimento, não por paciente.
  const emAberto = useMemo(() => {
    if (!dados) return [];
    return dados.atendimentos
      .map((a) => ({
        atendimento: a,
        resumo: resumoAtendimento(
          a,
          dados.recebimentos as RecebimentoRow[],
          dados.parcelas as ParcelaRow[],
        ),
      }))
      .filter((x) => x.resumo.saldo > MONETARY_EPSILON)
      .sort((a, b) => (b.atendimento.data ?? "").localeCompare(a.atendimento.data ?? ""));
  }, [dados]);

  const dtmDoPaciente = useMemo(() => {
    if (!dados || !paciente) return [];
    // Usa a regra canônica em vez de reimplementar o casamento por nome.
    return sortDtmAcompanhamentos(
      dados.dtmAcomp.filter((a) => pertenceAoPaciente(a, { id: paciente.id, nome: paciente.nome })),
    );
  }, [dados, paciente]);

  const consultasPorAcomp = useMemo(() => {
    const m = new Map<string, { numero: number; data_realizada: string }[]>();
    for (const c of dados?.dtmConsultas ?? []) {
      const list = m.get(c.acompanhamento_id) ?? [];
      list.push(c);
      m.set(c.acompanhamento_id, list);
    }
    for (const [k, list] of m) {
      list.sort((a, b) => a.numero - b.numero);
      m.set(k, list);
    }
    return m;
  }, [dados?.dtmConsultas]);

  if (consulta.isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (consulta.isError) {
    return (
      <div className="rounded-2xl border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
        <EmptyState
          icon={<UserX className="h-8 w-8 text-destructive" />}
          title="Não foi possível carregar este paciente"
          description="Verifique sua conexão e tente novamente."
          action={
            <Button variant="outline" onClick={() => consulta.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      </div>
    );
  }

  // Link antigo ou paciente excluído: mostra saída em vez de quebrar.
  if (!paciente) {
    return (
      <div className="rounded-2xl border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
        <EmptyState
          icon={<UserX className="h-8 w-8" />}
          title="Paciente não encontrado"
          description="Ele pode ter sido excluído."
          action={
            <Button asChild variant="outline">
              <Link to="/pacientes">Voltar para a lista</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={paciente.nome}
        description="Histórico completo e ações rápidas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to="/pacientes">
                <ArrowLeft className="h-4 w-4" /> Pacientes
              </Link>
            </Button>
            <ConsultaForm initialData={{ paciente: paciente.nome, pacienteId: paciente.id }} />
            <AtendimentoForm initialData={{ paciente: paciente.nome, pacienteId: paciente.id }} />
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-6">
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

      {emAberto.length > 0 && (
        <div
          className="rounded-2xl border bg-card mb-4"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <div className="border-b px-4 py-3 text-sm font-medium flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-warning" />
            Tratamentos com saldo em aberto
          </div>
          <ul className="divide-y">
            {emAberto.map(({ atendimento, resumo: r }) => (
              <li key={atendimento.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {atendimento.procedimento || "Atendimento"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateBR(atendimento.data)} · recebido {brl(r.recebido)} de {brl(r.total)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-warning tabular-nums">
                    {brl(r.saldo)}
                  </div>
                  <div className="text-xs text-muted-foreground">saldo</div>
                </div>
                <RegistrarRecebimento
                  atendimento={atendimento}
                  trigger={
                    <Button size="sm" className="h-8 gap-1">
                      <HandCoins className="h-4 w-4" /> Receber
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
        <div className="border-b px-4 py-3 text-sm font-medium">Histórico cronológico</div>
        {historico.length === 0 ? (
          <EmptyState
            title="Nenhum registro para este paciente ainda"
            description="Atendimentos, recebimentos e consultas aparecem aqui conforme forem lançados."
          />
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

      {dtmDoPaciente.length > 0 && (
        <div
          className="rounded-2xl border bg-card mt-4"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <div className="border-b px-4 py-3 text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Acompanhamentos DTM
          </div>
          <ul className="divide-y">
            {dtmDoPaciente.map((a) => {
              const cs = consultasPorAcomp.get(a.id) ?? [];
              const realizadas = cs.length;
              const faltantes = Math.max(a.total_consultas - realizadas, 0);
              const ultimas = cs.slice(-3).map((c) => formatDateBR(c.data_realizada));
              return (
                <li key={a.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">
                      {realizadas}/{a.total_consultas} consultas
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({faltantes} faltante{faltantes === 1 ? "" : "s"})
                      </span>
                    </div>
                    <Badge variant={a.status === "concluido" ? "secondary" : "default"}>
                      {a.status === "concluido" ? "Concluído" : "Em acompanhamento"}
                    </Badge>
                  </div>
                  <Progress
                    value={
                      a.total_consultas > 0
                        ? Math.min(100, (realizadas / a.total_consultas) * 100)
                        : 0
                    }
                  />
                  {ultimas.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Últimas: {ultimas.join(" · ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
