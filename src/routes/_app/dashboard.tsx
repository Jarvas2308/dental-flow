import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable } from "@/hooks/use-data";
import { brl, monthOptions, monthLabel, currentMonthKey, monthKey, parseLocalDate, todayISO } from "@/lib/format";
import {
  receitasRecebidas, valoresEmAberto,
  totalDespesasPagasNoMes, totalDespesasPendentesNoMes,
  caixaRealizado as calcCaixaRealizado, resultadoPrevisto as calcResultadoPrevisto,
} from "@/lib/finance";
import { proximaTentativa, estaPendenteHoje } from "@/lib/followup";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FlaskConical, CircleDollarSign,
  Clock, HandCoins, FileSignature, CalendarDays, CalendarClock, PhoneCall,
} from "lucide-react";
import { ProceduresAnalytics } from "@/components/procedures-analytics";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [mes, setMes] = useState(currentMonthKey());
  const opts = monthOptions(12);

  const atendimentos = useTable<any>("atendimentos", "data");
  const recebimentos = useTable<any>("recebimentos", "data", true);
  const parcelas = useTable<any>("parcelas", "vencimento", true);
  const despesas = useTable<any>("despesas", "vencimento");
  const lab = useTable<any>("custos_laboratorio", "data");
  const ganhos = useTable<any>("receitas_extras", "data");
  const consultas = useTable<any>("consultas_previstas", "data_prevista", true);
  const tratamentosPropostos = useTable<any>("tratamentos_propostos", "data_proposta", true);
  const tentativasContato = useTable<any>("tentativas_contato", "data", true);

  // Previsão de consultas futuras (hoje / semana)
  const previsao = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ws = new Date(today); ws.setDate(today.getDate() - today.getDay()); ws.setHours(0, 0, 0, 0);
    const we = new Date(ws); we.setDate(ws.getDate() + 6); we.setHours(23, 59, 59, 999);
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

  const pendentesFollowup = useMemo(() =>
    (tratamentosPropostos.data ?? [])
      .filter((t: any) => t.status === "acompanhando")
      .filter((t: any) => {
        const tts = (tentativasContato.data ?? []).filter((x: any) => x.tratamento_proposto_id === t.id);
        return estaPendenteHoje(proximaTentativa(t, tts).dataPrevista);
      }).length,
    [tratamentosPropostos.data, tentativasContato.data]
  );

  const filt = <T extends { data: string }>(rows: T[] = []) =>
    rows.filter((r) => monthKey(r.data) === mes);

  // Receita recebida (caixa): atendimentos pagos + parcelas pagas, posicionados
  // pela data do recebimento.
  const recebidas = useMemo(
    () => receitasRecebidas(atendimentos.data ?? [], recebimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, recebimentos.data, parcelas.data],
  );
  const recebidasMes = recebidas.filter((r) => monthKey(r.data) === mes);
  const totBruto = recebidasMes.reduce((s, r) => s + r.valor_bruto, 0);
  const totLiquidoAtend = recebidasMes.reduce((s, r) => s + r.valor_liquido, 0);

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

  const totGanhos = filt(ganhos.data).reduce((s, r: any) => s + Number(r.valor || 0), 0);
  // Receitas recebidas totais do período (atendimentos + ganhos extras).
  const totReceitaTotal = totLiquidoAtend + totGanhos;

  // Despesas pagas: somente status pago, posicionadas pela data_pagamento efetiva.
  const totDespPagas = totalDespesasPagasNoMes(despesas.data ?? [], mes);
  // Despesas pendentes: ainda não pagas, posicionadas pelo vencimento.
  const totDespPendentes = totalDespesasPendentesNoMes(despesas.data ?? [], mes);
  const totLab = filt(lab.data).reduce((s, r: any) => s + Number(r.valor || 0), 0);

  // Caixa realizado = recebimentos efetivos − despesas pagas (inclui custos de
  // laboratório realizados). Despesas pendentes NÃO reduzem o caixa realizado.
  const caixaRealizado = calcCaixaRealizado(totReceitaTotal, totDespPagas + totLab);
  // Resultado previsto = caixa realizado menos as despesas ainda pendentes.
  const resultadoPrevisto = calcResultadoPrevisto(caixaRealizado, totDespPendentes);


  // Mês anterior ao mês selecionado (não ao calendário) para comparação
  const prevMes = useMemo(() => {
    const [y, m] = mes.split("-").map(Number);
    return monthKey(new Date(y, m - 2, 1));
  }, [mes]);

  const totLiquidoAtendPrev = recebidas.filter((r) => monthKey(r.data) === prevMes).reduce((s, r) => s + r.valor_liquido, 0);
  const totGanhosPrev = (ganhos.data ?? []).filter((r: any) => monthKey(r.data) === prevMes).reduce((s, r: any) => s + Number(r.valor || 0), 0);
  const totReceitaTotalPrev = totLiquidoAtendPrev + totGanhosPrev;
  const totDespPagasPrev = totalDespesasPagasNoMes(despesas.data ?? [], prevMes);
  const totDespPendentesPrev = totalDespesasPendentesNoMes(despesas.data ?? [], prevMes);
  const totLabPrev = (lab.data ?? []).filter((r: any) => monthKey(r.data) === prevMes).reduce((s, r: any) => s + Number(r.valor || 0), 0);
  const caixaRealizadoPrev = calcCaixaRealizado(totReceitaTotalPrev, totDespPagasPrev + totLabPrev);
  const resultadoPrevistoPrev = calcResultadoPrevisto(caixaRealizadoPrev, totDespPendentesPrev);

  const variacao = (cur: number, prev: number) => {
    if (prev === 0) return "";
    const p = Math.round(((cur - prev) / prev) * 100);
    return ` · ${p >= 0 ? "+" : ""}${p}% vs mês anterior`;
  };

  const chartData = useMemo(() => {
    const months = monthOptions(6).reverse();
    return months.map((m) => {
      const recAtend = recebidas.filter((r) => monthKey(r.data) === m)
        .reduce((s, r) => s + r.valor_liquido, 0);
      const recExtra = (ganhos.data ?? []).filter((r: any) => monthKey(r.data) === m)
        .reduce((s, r: any) => s + Number(r.valor || 0), 0);
      const desp =
        totalDespesasPagasNoMes(despesas.data ?? [], m) +
        (lab.data ?? []).filter((r: any) => monthKey(r.data) === m).reduce((s, r: any) => s + Number(r.valor || 0), 0);
      return {
        mes: monthLabel(m).replace(" de ", "/"),
        Receita: Number((recAtend + recExtra).toFixed(2)),
        Despesas: Number(desp.toFixed(2)),
      };
    });
  }, [recebidas, despesas.data, lab.data, ganhos.data]);



  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral financeira do consultório"
        actions={
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {opts.map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Próximas Consultas</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <Link to="/followup" className="block">
          <StatCard label="Follow-up hoje" value={String(pendentesFollowup)} tone={pendentesFollowup > 0 ? "warning" : "default"} icon={<PhoneCall className="h-4 w-4" />} hint={pendentesFollowup > 0 ? "Tratamentos aguardando contato" : "Nenhuma pendência hoje"} />
        </Link>
        <Link to="/consultas" className="block">
          <StatCard label="Consultas hoje" value={String(previsao.hoje)} tone="primary" icon={<CalendarDays className="h-4 w-4" />} />
        </Link>
        <Link to="/consultas" className="block">
          <StatCard label="Consultas na semana" value={String(previsao.semana)} icon={<CalendarClock className="h-4 w-4" />} />
        </Link>
        <StatCard label="Valor previsto da semana" value={brl(previsao.valorSemana)} tone="success" icon={<CircleDollarSign className="h-4 w-4" />} hint="Estimado" />
      </div>



      {/* Receitas */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Receitas</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/consultorio" className="block">
          <StatCard label="Receita de Atendimentos" value={brl(totLiquidoAtend)} tone="primary" icon={<TrendingUp className="h-4 w-4" />} hint={`Bruto ${brl(totBruto)} · apenas pagos${variacao(totLiquidoAtend, totLiquidoAtendPrev)}`} />
        </Link>
        <Link to="/ganhos" className="block">
          <StatCard label="Receitas Extras" value={brl(totGanhos)} icon={<CircleDollarSign className="h-4 w-4" />} hint="Aluguel, rendimentos, etc." />
        </Link>
        <StatCard label="Receita Total" value={brl(totReceitaTotal)} tone="success" icon={<CircleDollarSign className="h-4 w-4" />} hint={`Atendimentos pagos + extras${variacao(totReceitaTotal, totReceitaTotalPrev)}`} />
      </div>

      {/* Contas a Receber */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contas a Receber</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receita Recebida" value={brl(totLiquidoAtend)} tone="success" icon={<HandCoins className="h-4 w-4" />} hint={`${monthLabel(mes)} · caixa`} />
        <Link to="/contas-receber" className="block">
          <StatCard label="Valores em Aberto" value={brl(totPendente)} tone={totPendente > 0 ? "warning" : "success"} icon={<Clock className="h-4 w-4" />} hint={`${qtdPendente} parcela(s) · todos os meses`} />
        </Link>
        <StatCard label="Receita Contratada" value={brl(totContratado)} tone="primary" icon={<FileSignature className="h-4 w-4" />} hint="Recebido + a receber" />
      </div>





      {/* Resultado */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resultado</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Caixa Realizado" value={brl(caixaRealizado)} tone={caixaRealizado >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} hint={`Recebido − despesas pagas${variacao(caixaRealizado, caixaRealizadoPrev)}`} />
        <StatCard label="Resultado Previsto" value={brl(resultadoPrevisto)} tone={resultadoPrevisto >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} hint={`Caixa − despesas pendentes${variacao(resultadoPrevisto, resultadoPrevistoPrev)}`} />
        <Link to="/contas" className="block">
          <StatCard label="Despesas Pagas" value={brl(totDespPagas)} tone="warning" icon={<Receipt className="h-4 w-4" />} hint={`${monthLabel(mes)} · por data de pagamento`} />
        </Link>
        <Link to="/contas" className="block">
          <StatCard label="Despesas Pendentes" value={brl(totDespPendentes)} tone={totDespPendentes > 0 ? "warning" : "success"} icon={<TrendingDown className="h-4 w-4" />} hint="Não reduzem o caixa realizado" />
        </Link>
        <Link to="/laboratorio" className="block">
          <StatCard label="Laboratório" value={brl(totLab)} icon={<FlaskConical className="h-4 w-4" />} />
        </Link>
      </div>

      <div
        className="mt-6 rounded-2xl border bg-card p-5"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Evolução financeira</h3>
            <p className="text-xs text-muted-foreground">Atendimentos vs ganhos extras · últimos 6 meses</p>
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }}
                formatter={(v: any) => brl(Number(v))}
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
