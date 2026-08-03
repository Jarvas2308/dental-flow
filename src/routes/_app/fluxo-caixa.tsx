import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useTable } from "@/hooks/use-data";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
import { brl, currentMonthKey, monthKey, monthLabel, parseLocalDate } from "@/lib/format";
import { parseMes, parseOpcao, parseTexto } from "@/lib/search-params";
import {
  receitasRecebidas,
  despesasPagas as despesasPagasFn,
  MONETARY_EPSILON,
} from "@/lib/finance";
import { PageHeader, StatCard, ErrorState, MonthSelect } from "@/components/ui-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  Target,
  Activity,
  Stethoscope,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FiltroPag = "todas" | string;
type Visao = "clinica" | "geral";

const VISOES = ["clinica", "geral"] as const;

// Mês, visão e forma de pagamento são todos contexto de leitura da tela, então
// vão juntos para a URL — um link compartilhado reabre exatamente o mesmo
// recorte.
type FluxoSearch = { mes?: string; visao?: Visao; pag?: string };

export const Route = createFileRoute("/_app/fluxo-caixa")({
  validateSearch: (s: Record<string, unknown>): FluxoSearch => ({
    mes: parseMes(s.mes),
    visao: parseOpcao(s.visao, VISOES),
    pag: parseTexto(s.pag),
  }),
  component: FluxoCaixa,
});

function FluxoCaixa() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/fluxo-caixa" });

  const mes = search.mes ?? currentMonthKey();
  const visao: Visao = search.visao ?? "geral";
  const pagamento: FiltroPag = search.pag ?? "todas";
  const isClinica = visao === "clinica";

  const setSearch = useCallback(
    (patch: Partial<FluxoSearch>) =>
      navigate({ search: (prev: FluxoSearch) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );
  const setMes = useCallback((novo: string) => setSearch({ mes: novo }), [setSearch]);
  const setVisao = useCallback((novo: Visao) => setSearch({ visao: novo }), [setSearch]);
  // "todas" é o padrão, então some da URL em vez de virar ?pag=todas.
  const setPagamento = useCallback(
    (novo: string) => setSearch({ pag: novo === "todas" ? undefined : novo }),
    [setSearch],
  );

  const atendimentos = useTable<Tables<"atendimentos">>("atendimentos", "data");
  const recebimentos = useTable<Tables<"recebimentos">>("recebimentos", "data", true);
  const parcelas = useTable<Tables<"parcelas">>("parcelas", "vencimento", true);
  const despesas = useTable<Tables<"despesas">>("despesas", "vencimento");
  const lab = useTable<Tables<"custos_laboratorio">>("custos_laboratorio", "data");
  const ganhos = useTable<Tables<"receitas_extras">>("receitas_extras", "data");

  const isLoading =
    atendimentos.isLoading ||
    parcelas.isLoading ||
    despesas.isLoading ||
    lab.isLoading ||
    ganhos.isLoading;
  const isError =
    atendimentos.isError || parcelas.isError || despesas.isError || lab.isError || ganhos.isError;
  const refetch = () => {
    atendimentos.refetch();
    parcelas.refetch();
    despesas.refetch();
    lab.refetch();
    ganhos.refetch();
  };

  const [year, monthNum] = mes.split("-").map(Number);
  const diasNoMes = new Date(year, monthNum, 0).getDate();
  const hoje = useMemo(() => new Date(), []);
  const ehMesAtual = currentMonthKey() === mes;
  const diaAtual = ehMesAtual ? Math.min(hoje.getDate(), diasNoMes) : diasNoMes;

  // Receita recebida (caixa): atendimentos pagos + parcelas pagas
  const recebidas = useMemo(
    () => receitasRecebidas(atendimentos.data ?? [], recebimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, recebimentos.data, parcelas.data],
  );

  const formasPag = useMemo(() => {
    const set = new Set<string>();
    recebidas.forEach((r) => r.forma_pagamento && set.add(r.forma_pagamento));
    return Array.from(set).sort();
  }, [recebidas]);

  // Entradas: visão clínica = só atendimentos. Visão geral = atendimentos + ganhos extras.
  const ent = useMemo(() => {
    const a = recebidas
      .filter((r) => monthKey(r.data) === mes)
      .filter((r) => pagamento === "todas" || r.forma_pagamento === pagamento)
      .map((r) => ({ data: r.data, valor: r.valor_liquido, _origem: "Atendimento" }));
    if (isClinica) return a;
    const g =
      pagamento === "todas"
        ? (ganhos.data ?? [])
            .filter((r) => monthKey(r.data) === mes)
            .map((r) => ({ data: r.data, valor: Number(r.valor || 0), _origem: "Ganho extra" }))
        : [];
    return [...a, ...g];
  }, [recebidas, ganhos.data, mes, pagamento, isClinica]);

  // Despesas no caixa realizado: somente as efetivamente pagas, posicionadas
  // na data_pagamento (data da saída real). Pendentes/atrasadas não pagas ficam de fora.
  const despesasPagas = useMemo(
    () => despesasPagasFn(despesas.data ?? []).map((r) => ({ ...r, _origem: "Despesa" })),
    [despesas.data],
  );

  // Saídas: clínica = apenas custos de laboratório. Geral = despesas pagas + lab.
  const sai = useMemo(() => {
    const all = isClinica
      ? (lab.data ?? []).map((r) => ({ ...r, _origem: "Laboratório" }))
      : [...despesasPagas, ...(lab.data ?? []).map((r) => ({ ...r, _origem: "Laboratório" }))];
    return all.filter((r) => monthKey(r.data ?? "") === mes);
  }, [despesasPagas, lab.data, mes, isClinica]);

  const totalEntradas = ent.reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalSaidas = sai.reduce((s, r) => s + Number(r.valor || 0), 0);
  const lucroLiquido = totalEntradas - totalSaidas;

  // Saldo acumulado de TODOS os meses até o final do mês selecionado
  const saldoAcumulado = useMemo(() => {
    const limite = new Date(year, monthNum - 1, diasNoMes);
    const ents =
      recebidas
        .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= limite)
        .reduce((s, r) => s + r.valor_liquido, 0) +
      (isClinica
        ? 0
        : (ganhos.data ?? [])
            .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= limite)
            .reduce((s, r) => s + Number(r.valor || 0), 0));
    const sds =
      (isClinica
        ? 0
        : despesasPagas
            .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= limite)
            .reduce((s, r) => s + Number(r.valor || 0), 0)) +
      (lab.data ?? [])
        .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= limite)
        .reduce((s, r) => s + Number(r.valor || 0), 0);
    return ents - sds;
  }, [recebidas, despesasPagas, lab.data, ganhos.data, year, monthNum, diasNoMes, isClinica]);

  // Saldo atual (até hoje, considerando todos os meses)
  const saldoAtual = useMemo(() => {
    const ents =
      recebidas
        .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= hoje)
        .reduce((s, r) => s + r.valor_liquido, 0) +
      (isClinica
        ? 0
        : (ganhos.data ?? [])
            .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= hoje)
            .reduce((s, r) => s + Number(r.valor || 0), 0));
    const sds =
      (isClinica
        ? 0
        : despesasPagas
            .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= hoje)
            .reduce((s, r) => s + Number(r.valor || 0), 0)) +
      (lab.data ?? [])
        .filter((r) => (parseLocalDate(r.data) ?? new Date(0)) <= hoje)
        .reduce((s, r) => s + Number(r.valor || 0), 0);
    return ents - sds;
  }, [recebidas, despesasPagas, lab.data, ganhos.data, isClinica, hoje]);

  // Dias do mês com agregados
  const diario = useMemo(() => {
    const arr = Array.from({ length: diasNoMes }, (_, i) => {
      const d = i + 1;
      const isoDay = `${mes}-${String(d).padStart(2, "0")}`;
      const e = ent.filter((r) => r.data === isoDay).reduce((s, r) => s + Number(r.valor || 0), 0);
      const s = sai
        .filter((r) => r.data === isoDay)
        .reduce((su, r) => su + Number(r.valor || 0), 0);
      return {
        dia: d,
        diaLabel: String(d).padStart(2, "0"),
        entradas: Number(e.toFixed(2)),
        saidas: Number(s.toFixed(2)),
        saldoDia: Number((e - s).toFixed(2)),
        futuro: ehMesAtual && d > diaAtual,
      };
    });
    let acc = 0;
    return arr.map((r) => {
      acc += r.saldoDia;
      return { ...r, acumulado: Number(acc.toFixed(2)) };
    });
  }, [diasNoMes, mes, ent, sai, ehMesAtual, diaAtual]);

  // Previsão
  const diasComMov = diario.slice(0, diaAtual).filter((d) => d.entradas > 0).length || 1;
  const mediaDiariaEnt = totalEntradas / diasComMov;
  const projecaoEntradas = ehMesAtual
    ? totalEntradas + mediaDiariaEnt * (diasNoMes - diaAtual)
    : totalEntradas;
  // Saídas ainda por vir: despesas do mês com vencimento nos dias restantes
  // que ainda não foram pagas (evita projeção otimista que ignora contas
  // já lançadas mas com vencimento futuro).
  const saidasFuturas =
    ehMesAtual && !isClinica
      ? (despesas.data ?? [])
          .filter((r) => r.status !== "pago")
          .filter((r) => monthKey(r.vencimento) === mes)
          .filter((r) => {
            const dia = parseLocalDate(r.vencimento)?.getDate() ?? 0;
            return dia > diaAtual;
          })
          .reduce((s, r) => s + Number(r.valor || 0), 0)
      : 0;
  const projecaoSaidas = totalSaidas + saidasFuturas;
  const projecaoSaldo = projecaoEntradas - projecaoSaidas;
  const tendencia = projecaoSaldo >= lucroLiquido ? "alta" : "baixa";

  const labelMes = monthLabel(mes);

  return (
    <>
      <PageHeader
        title="Fluxo de Caixa"
        description={
          isClinica
            ? "Apenas atendimentos e custos clínicos — performance do consultório"
            : "Visão completa: atendimentos, ganhos extras e despesas"
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            <div className="inline-flex rounded-lg border bg-card p-0.5">
              <button
                type="button"
                onClick={() => setVisao("clinica")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                  isClinica
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Stethoscope className="h-3.5 w-3.5" /> Clínica
              </button>
              <button
                type="button"
                onClick={() => setVisao("geral")}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors",
                  !isClinica
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Layers className="h-3.5 w-3.5" /> Geral
              </button>
            </div>
            <MonthSelect value={mes} onChange={setMes} className="w-[180px]" />
            <Select value={pagamento} onValueChange={setPagamento}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas formas</SelectItem>
                {formasPag.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 animate-pulse h-32" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
          <ErrorState
            title="Não foi possível carregar o fluxo de caixa"
            description="Os totais acima podem estar incompletos. Recarregue para ver os números corretos."
            onRetry={refetch}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label="Saldo atual"
              value={brl(saldoAtual)}
              tone={saldoAtual >= 0 ? "success" : "destructive"}
              icon={<Wallet className="h-4 w-4" />}
              hint="Até hoje, todas as movimentações"
            />
            <StatCard
              label={`Entradas · ${labelMes}`}
              value={brl(totalEntradas)}
              tone="primary"
              icon={<ArrowDownCircle className="h-4 w-4" />}
              hint={
                isClinica ? `${ent.length} atendimentos` : `Atend. + ganhos extras (${ent.length})`
              }
            />
            <StatCard
              label={`Saídas · ${labelMes}`}
              value={brl(totalSaidas)}
              tone="warning"
              icon={<ArrowUpCircle className="h-4 w-4" />}
              hint={isClinica ? "Apenas custos de laboratório" : "Despesas + laboratório"}
            />
            <StatCard
              label={isClinica ? "Lucro operacional" : "Lucro geral do mês"}
              value={brl(lucroLiquido)}
              tone={lucroLiquido >= 0 ? "success" : "destructive"}
              icon={<Activity className="h-4 w-4" />}
              hint={isClinica ? "Performance clínica pura" : "Inclui ganhos extras e despesas"}
            />
            {/* "Saldo atual" (até hoje) e "Saldo acumulado" (até o fim do mês
                selecionado) são o mesmo número quando o mês em tela já passou
                ou é o corrente sem lançamentos futuros. Nesses casos o card só
                repetia o valor de cima, então some. */}
            {Math.abs(saldoAcumulado - saldoAtual) > MONETARY_EPSILON && (
              <StatCard
                label="Saldo acumulado"
                value={brl(saldoAcumulado)}
                tone={saldoAcumulado >= 0 ? "success" : "destructive"}
                icon={<TrendingUp className="h-4 w-4" />}
                hint={`Histórico até o fim de ${labelMes}`}
              />
            )}
            <StatCard
              label="Projeção do mês"
              value={brl(projecaoSaldo)}
              tone={tendencia === "alta" ? "success" : "warning"}
              icon={<Target className="h-4 w-4" />}
              hint={ehMesAtual ? `Média diária: ${brl(mediaDiariaEnt)}` : "Mês fechado"}
            />
          </div>

          {/* Charts */}
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Antes havia dois gráficos aqui plotando a mesma série
                `acumulado` — um de área e outro de linha. Ficou só o de
                linha, que já mostrava o acumulado E o saldo do dia. */}
            <ChartCard title="Saldo acumulado" subtitle={`Dia a dia · ${labelMes}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={diario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="diaLabel"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                    }}
                    formatter={(v: number | string) => brl(Number(v))}
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="acumulado"
                    name="Saldo acumulado"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={false}
                    animationDuration={800}
                  />
                  <Line
                    type="monotone"
                    dataKey="saldoDia"
                    name="Saldo do dia"
                    stroke="var(--chart-2)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    animationDuration={900}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Entradas vs Saídas" subtitle="Por dia do mês">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diario}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="diaLabel"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={10}
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
                    labelFormatter={(l) => `Dia ${l}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar
                    dataKey="entradas"
                    name="Entradas"
                    fill="var(--chart-2)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={600}
                  />
                  <Bar
                    dataKey="saidas"
                    name="Saídas"
                    fill="var(--chart-4)"
                    radius={[6, 6, 0, 0]}
                    animationDuration={700}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Calendário financeiro */}
          <div
            className="mt-6 rounded-2xl border bg-card p-5"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="font-semibold">Calendário financeiro</h3>
                <p className="text-xs text-muted-foreground capitalize">{labelMes}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Legenda cor="var(--chart-2)" txt="Entrada" />
                <Legenda cor="var(--chart-4)" txt="Saída" />
                <Legenda cor="var(--chart-1)" txt="Saldo positivo" />
              </div>
            </div>
            <CalendarioGrid mes={mes} dias={diario} />
          </div>
        </>
      )}
    </>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
      <div className="mb-4">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground capitalize">{subtitle}</p>}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function Legenda({ cor, txt }: { cor: string; txt: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} />
      {txt}
    </span>
  );
}

function CalendarioGrid({
  mes,
  dias,
}: {
  mes: string;
  dias: { dia: number; entradas: number; saidas: number; saldoDia: number; futuro: boolean }[];
}) {
  const [year, monthNum] = mes.split("-").map(Number);
  const primeiroDiaSemana = new Date(year, monthNum - 1, 1).getDay();
  const padding = Array.from({ length: primeiroDiaSemana });
  const semanas = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {semanas.map((s) => (
          <div
            key={s}
            className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground text-center"
          >
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {padding.map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {dias.map((d) => {
          const positivo = d.saldoDia > 0;
          const negativo = d.saldoDia < 0;
          const semMov = d.entradas === 0 && d.saidas === 0;
          return (
            <div
              key={d.dia}
              className={cn(
                "rounded-lg border p-2 min-h-[78px] text-left transition-all hover:shadow-[var(--shadow-soft)]",
                d.futuro && "opacity-50",
                semMov && "bg-muted/20",
                positivo && !semMov && "border-success/40 bg-success/5",
                negativo && "border-destructive/40 bg-destructive/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tabular-nums">{d.dia}</span>
                {!semMov && (
                  <span
                    className={cn(
                      "text-[9px] font-semibold tabular-nums",
                      positivo && "text-success",
                      negativo && "text-destructive",
                    )}
                  >
                    {positivo ? "+" : ""}
                    {compact(d.saldoDia)}
                  </span>
                )}
              </div>
              {!semMov && (
                <div className="mt-1.5 space-y-0.5">
                  {d.entradas > 0 && (
                    <div className="text-[9px] text-muted-foreground tabular-nums truncate">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full mr-1"
                        style={{ background: "var(--chart-2)" }}
                      />
                      {compact(d.entradas)}
                    </div>
                  )}
                  {d.saidas > 0 && (
                    <div className="text-[9px] text-muted-foreground tabular-nums truncate">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full mr-1"
                        style={{ background: "var(--chart-4)" }}
                      />
                      {compact(d.saidas)}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function compact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return `R$${v.toFixed(0)}`;
}
