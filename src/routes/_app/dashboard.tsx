import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useTable } from "@/hooks/use-data";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
import {
  brl,
  monthOptions,
  monthLabel,
  currentMonthKey,
  monthKey,
  parseLocalDate,
  todayISO,
} from "@/lib/format";
import { parseMes } from "@/lib/search-params";
import { receitasRecebidas, valoresEmAberto, resumoMensal } from "@/lib/finance";
import { proximaTentativa, estaPendenteHoje } from "@/lib/followup";
import { PageHeader, StatCard, ErrorState, MonthSelect } from "@/components/ui-kit";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  FlaskConical,
  CircleDollarSign,
  Clock,
  FileSignature,
  CalendarDays,
  CalendarClock,
  PhoneCall,
} from "lucide-react";
import { ProceduresAnalytics } from "@/components/procedures-analytics";

// `mes` fica opcional de propósito: um schema obrigatório tornaria `search`
// obrigatório em todo <Link to="/dashboard">, quebrando a navegação genérica
// da sidebar. Ausente, a tela cai no mês corrente.
type DashboardSearch = { mes?: string };

export const Route = createFileRoute("/_app/dashboard")({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({ mes: parseMes(s.mes) }),
  component: Dashboard,
});

function Dashboard() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/dashboard" });
  const mes = search.mes ?? currentMonthKey();

  // Atualização funcional para preservar quaisquer outros params; `replace`
  // evita empilhar uma entrada de histórico por troca de mês.
  const setMes = useCallback(
    (novo: string) =>
      navigate({ search: (prev: DashboardSearch) => ({ ...prev, mes: novo }), replace: true }),
    [navigate],
  );

  const atendimentos = useTable<Tables<"atendimentos">>("atendimentos", "data");
  const recebimentos = useTable<Tables<"recebimentos">>("recebimentos", "data", true);
  const parcelas = useTable<Tables<"parcelas">>("parcelas", "vencimento", true);
  const despesas = useTable<Tables<"despesas">>("despesas", "vencimento");
  const lab = useTable<Tables<"custos_laboratorio">>("custos_laboratorio", "data");
  const ganhos = useTable<Tables<"receitas_extras">>("receitas_extras", "data");
  const consultas = useTable<Tables<"consultas_previstas">>(
    "consultas_previstas",
    "data_prevista",
    true,
  );
  const tratamentosPropostos = useTable<Tables<"tratamentos_propostos">>(
    "tratamentos_propostos",
    "data_proposta",
    true,
  );
  const tentativasContato = useTable<Tables<"tentativas_contato">>(
    "tentativas_contato",
    "data",
    true,
  );

  const isError =
    atendimentos.isError ||
    recebimentos.isError ||
    parcelas.isError ||
    despesas.isError ||
    lab.isError ||
    ganhos.isError ||
    consultas.isError ||
    tratamentosPropostos.isError ||
    tentativasContato.isError;
  const refetch = () => {
    atendimentos.refetch();
    recebimentos.refetch();
    parcelas.refetch();
    despesas.refetch();
    lab.refetch();
    ganhos.refetch();
    consultas.refetch();
    tratamentosPropostos.refetch();
    tentativasContato.refetch();
  };

  // Previsão de consultas futuras (hoje / semana)
  const previsao = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ws = new Date(today);
    ws.setDate(today.getDate() - today.getDay());
    ws.setHours(0, 0, 0, 0);
    const we = new Date(ws);
    we.setDate(ws.getDate() + 6);
    we.setHours(23, 59, 59, 999);
    const todayKey = todayISO();
    const ativos = (consultas.data ?? []).filter((c) => !c.realizada);
    const hoje = ativos.filter((c) => c.data_prevista === todayKey).length;
    const semana = ativos.filter((c) => {
      const d = parseLocalDate(c.data_prevista);
      return d && d >= ws && d <= we;
    });
    const valorSemana = semana.reduce((s, c) => s + Number(c.valor_estimado || 0), 0);
    return { hoje, semana: semana.length, valorSemana };
  }, [consultas.data]);

  const pendentesFollowup = useMemo(
    () =>
      (tratamentosPropostos.data ?? [])
        .filter((t) => t.status === "acompanhando")
        .filter((t) => {
          const tts = (tentativasContato.data ?? []).filter(
            (x) => x.tratamento_proposto_id === t.id,
          );
          return estaPendenteHoje(proximaTentativa(t, tts).dataPrevista);
        }).length,
    [tratamentosPropostos.data, tentativasContato.data],
  );

  // Receita recebida (caixa): atendimentos pagos + parcelas pagas, posicionados
  // pela data do recebimento.
  const recebidas = useMemo(
    () => receitasRecebidas(atendimentos.data ?? [], recebimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, recebimentos.data, parcelas.data],
  );

  // Valores em aberto / contas a receber (todos os meses, persistem até quitar)
  const aberto = useMemo(
    () => valoresEmAberto(atendimentos.data ?? [], recebimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, recebimentos.data, parcelas.data],
  );
  const totPendente = aberto.reduce((s, r) => s + r.valor_liquido, 0);
  const qtdPendente = aberto.length;
  // Receita contratada total = já recebido (todos os meses) + a receber
  const totRecebidoGeral = recebidas.reduce((s, r) => s + r.valor_liquido, 0);
  const totContratado = totRecebidoGeral + totPendente;

  // Mês anterior ao mês selecionado (não ao calendário) para comparação
  const prevMes = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    return monthKey(new Date(y, m - 2, 1));
  }, [mes]);

  // Fonte única da fórmula do mês (ver `resumoMensal` em lib/finance.ts). A
  // ferramenta MCP `resumo_financeiro` consome a mesma função, então os dois
  // não podem divergir.
  const dados = useMemo(
    () => ({
      atendimentos: atendimentos.data ?? [],
      recebimentos: recebimentos.data ?? [],
      parcelas: parcelas.data ?? [],
      despesas: despesas.data ?? [],
      ganhos: ganhos.data ?? [],
      lab: lab.data ?? [],
    }),
    [atendimentos.data, recebimentos.data, parcelas.data, despesas.data, ganhos.data, lab.data],
  );
  const resumo = useMemo(() => resumoMensal(dados, mes), [dados, mes]);
  const resumoPrev = useMemo(() => resumoMensal(dados, prevMes), [dados, prevMes]);

  const totBruto = resumo.recebidoBruto;
  const totLiquidoAtend = resumo.recebidoLiquido;
  const totGanhos = resumo.ganhos;
  const totReceitaTotal = resumo.receitaTotal;
  const totDespPagas = resumo.despesasPagas;
  const totDespPendentes = resumo.despesasPendentes;
  const totLab = resumo.custosLaboratorio;
  const caixaRealizado = resumo.caixaRealizado;
  const resultadoPrevisto = resumo.resultadoPrevisto;

  const totLiquidoAtendPrev = resumoPrev.recebidoLiquido;
  const totReceitaTotalPrev = resumoPrev.receitaTotal;
  const caixaRealizadoPrev = resumoPrev.caixaRealizado;
  const resultadoPrevistoPrev = resumoPrev.resultadoPrevisto;

  const variacao = (cur: number, prev: number) => {
    if (prev === 0) return "";
    const p = Math.round(((cur - prev) / prev) * 100);
    return ` · ${p >= 0 ? "+" : ""}${p}% vs mês anterior`;
  };

  const chartData = useMemo(() => {
    const months = monthOptions(6).reverse();
    return months.map((m) => {
      const r = resumoMensal(dados, m);
      return {
        mes: monthLabel(m).replace(" de ", "/"),
        Receita: Number(r.receitaTotal.toFixed(2)),
        Despesas: Number((r.despesasPagas + r.custosLaboratorio).toFixed(2)),
      };
    });
  }, [dados]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral financeira do consultório"
        actions={<MonthSelect value={mes} onChange={setMes} />}
      />

      {isError && (
        <div
          className="rounded-2xl border bg-card mb-6"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <ErrorState
            title="Não foi possível carregar o dashboard"
            description="Os totais abaixo podem estar incompletos. Recarregue para ver os números corretos."
            onRetry={refetch}
          />
        </div>
      )}

      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Próximas Consultas
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Link to="/followup" className="block">
          <StatCard
            label="Follow-up hoje"
            value={String(pendentesFollowup)}
            tone={pendentesFollowup > 0 ? "warning" : "default"}
            icon={<PhoneCall className="h-4 w-4" />}
            hint={
              pendentesFollowup > 0 ? "Tratamentos aguardando contato" : "Nenhuma pendência hoje"
            }
          />
        </Link>
        <Link to="/consultas" className="block">
          <StatCard
            label="Consultas hoje"
            value={String(previsao.hoje)}
            tone="primary"
            icon={<CalendarDays className="h-4 w-4" />}
          />
        </Link>
        <Link to="/consultas" className="block">
          <StatCard
            label="Consultas na semana"
            value={String(previsao.semana)}
            icon={<CalendarClock className="h-4 w-4" />}
          />
        </Link>
        <StatCard
          label="Valor previsto da semana"
          value={brl(previsao.valorSemana)}
          tone="success"
          icon={<CircleDollarSign className="h-4 w-4" />}
          hint="Estimado"
        />
      </div>

      {/* Receitas */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Receitas
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/consultorio" search={{ mes }} className="block">
          <StatCard
            label="Receita de Atendimentos"
            value={brl(totLiquidoAtend)}
            tone="primary"
            icon={<TrendingUp className="h-4 w-4" />}
            hint={`Bruto ${brl(totBruto)} · apenas pagos${variacao(totLiquidoAtend, totLiquidoAtendPrev)}`}
          />
        </Link>
        <Link to="/ganhos" search={{ mes }} className="block">
          <StatCard
            label="Receitas Extras"
            value={brl(totGanhos)}
            icon={<CircleDollarSign className="h-4 w-4" />}
            hint="Aluguel, rendimentos, etc."
          />
        </Link>
        <StatCard
          label="Receita Total"
          value={brl(totReceitaTotal)}
          tone="success"
          icon={<CircleDollarSign className="h-4 w-4" />}
          hint={`Atendimentos pagos + extras${variacao(totReceitaTotal, totReceitaTotalPrev)}`}
        />
      </div>

      {/* Contas a Receber */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Contas a Receber
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      {/* O card "Receita Recebida" que existia aqui foi removido: era a mesma
          variável do card "Receita de Atendimentos" logo acima, e o próprio
          hint dizia isso. Duas leituras do mesmo número na mesma tela só
          geram dúvida sobre qual é a certa. */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {/* Sem `search={{ mes }}`: esta tela é deliberadamente de todos os
            meses (o próprio hint diz isso). Levar o mês sugeriria um recorte
            que o destino não tem. Vale o mesmo para /consultas e /followup. */}
        <Link to="/contas-receber" className="block">
          <StatCard
            label="Valores em Aberto"
            value={brl(totPendente)}
            tone={totPendente > 0 ? "warning" : "success"}
            icon={<Clock className="h-4 w-4" />}
            hint={`${qtdPendente} parcela(s) · todos os meses`}
          />
        </Link>
        <StatCard
          label="Receita Contratada"
          value={brl(totContratado)}
          tone="primary"
          icon={<FileSignature className="h-4 w-4" />}
          hint="Recebido + a receber"
        />
      </div>

      {/* Resultado */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Resultado
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Caixa Realizado"
          value={brl(caixaRealizado)}
          tone={caixaRealizado >= 0 ? "success" : "destructive"}
          icon={<Wallet className="h-4 w-4" />}
          hint={`Recebido − despesas pagas${variacao(caixaRealizado, caixaRealizadoPrev)}`}
        />
        <StatCard
          label="Resultado Previsto"
          value={brl(resultadoPrevisto)}
          tone={resultadoPrevisto >= 0 ? "success" : "destructive"}
          icon={<Wallet className="h-4 w-4" />}
          hint={`Caixa − despesas pendentes${variacao(resultadoPrevisto, resultadoPrevistoPrev)}`}
        />
        <Link to="/contas" search={{ mes }} className="block">
          <StatCard
            label="Despesas Pagas"
            value={brl(totDespPagas)}
            tone="warning"
            icon={<Receipt className="h-4 w-4" />}
            hint={`${monthLabel(mes)} · por data de pagamento`}
          />
        </Link>
        <Link to="/contas" search={{ mes }} className="block">
          <StatCard
            label="Despesas Pendentes"
            value={brl(totDespPendentes)}
            tone={totDespPendentes > 0 ? "warning" : "success"}
            icon={<TrendingDown className="h-4 w-4" />}
            hint="Não reduzem o caixa realizado"
          />
        </Link>
        <Link to="/laboratorio" search={{ mes }} className="block">
          <StatCard
            label="Laboratório"
            value={brl(totLab)}
            icon={<FlaskConical className="h-4 w-4" />}
          />
        </Link>
      </div>

      <div
        className="mt-6 rounded-2xl border bg-card p-5"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Evolução financeira</h3>
            <p className="text-xs text-muted-foreground">
              Atendimentos vs ganhos extras · últimos 6 meses
            </p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="mes"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
                formatter={(v: number | string) => brl(Number(v))}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receita" fill="var(--chart-1)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ProceduresAnalytics mes={mes} />
    </>
  );
}
