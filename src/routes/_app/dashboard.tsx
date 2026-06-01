import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable } from "@/hooks/use-data";
import { brl, monthOptions, monthLabel, currentMonthKey, monthKey } from "@/lib/format";
import { receitasRecebidas, valoresEmAberto, resumoAtendimento } from "@/lib/finance";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FlaskConical, CircleDollarSign,
  Clock, Users, HandCoins, FileSignature,
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

  const filt = <T extends { data: string }>(rows: T[] = []) =>
    rows.filter((r) => monthKey(r.data) === mes);

  const filtDesp = (rows: any[] = []) =>
    rows.filter((r) => monthKey(r.vencimento) === mes);

  // Receita recebida (caixa): atendimentos pagos + parcelas pagas
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
  const pacientesPendentes = Array.from(new Set(aberto.map((r) => r.paciente).filter(Boolean)));
  // Receita contratada total = já recebido (todos os meses) + a receber
  const totRecebidoGeral = recebidas.reduce((s, r) => s + r.valor_liquido, 0);
  const totContratado = totRecebidoGeral + totPendente;

  // Tratamentos parcelados por status
  const tratamentos = useMemo(() => {
    const ps = (atendimentos.data ?? []).filter((a) => a.parcelado);
    let quitados = 0, parciais = 0, abertos = 0;
    for (const a of ps) {
      const r = resumoAtendimento(a, recebimentos.data ?? [], parcelas.data ?? []);
      if (r.status === "quitado") quitados++;
      else if (r.status === "parcial") parciais++;
      else abertos++;
    }
    return { total: ps.length, quitados, parciais, abertos };
  }, [atendimentos.data, recebimentos.data, parcelas.data]);

  const totGanhos = filt(ganhos.data).reduce((s, r: any) => s + Number(r.valor || 0), 0);
  const totReceitaTotal = totLiquidoAtend + totGanhos;
  const totDesp = filtDesp(despesas.data ?? []).reduce((s, r: any) => s + Number(r.valor || 0), 0);
  const totDespPagas = filtDesp(despesas.data ?? []).filter((r: any) => r.status === "pago").reduce((s, r: any) => s + Number(r.valor || 0), 0);
  const totDespPendentes = totDesp - totDespPagas;
  const totLab = filt(lab.data).reduce((s, r: any) => s + Number(r.valor || 0), 0);

  // Lucro operacional = só consultório (receita atend - despesas - lab)
  const lucroOperacional = totLiquidoAtend - totDesp - totLab;
  // Lucro geral = inclui ganhos extras
  const lucroGeral = totReceitaTotal - totDesp - totLab;

  const chartData = useMemo(() => {
    const months = monthOptions(6).reverse();
    return months.map((m) => {
      const recAtend = recebidas.filter((r) => monthKey(r.data) === m)
        .reduce((s, r) => s + r.valor_liquido, 0);
      const recExtra = (ganhos.data ?? []).filter((r: any) => monthKey(r.data) === m)
        .reduce((s, r: any) => s + Number(r.valor || 0), 0);
      const pend = aberto.filter((r) => monthKey(r.vencimento) === m)
        .reduce((s, r) => s + r.valor_liquido, 0);
      const desp =
        (despesas.data ?? []).filter((r: any) => monthKey(r.vencimento) === m).reduce((s, r: any) => s + Number(r.valor || 0), 0) +
        (lab.data ?? []).filter((r: any) => monthKey(r.data) === m).reduce((s, r: any) => s + Number(r.valor || 0), 0);
      return {
        mes: monthLabel(m).replace(" de ", "/"),
        Atendimentos: Number(recAtend.toFixed(2)),
        "Ganhos extras": Number(recExtra.toFixed(2)),
        "Em aberto": Number(pend.toFixed(2)),
        Despesas: Number(desp.toFixed(2)),
        "Lucro geral": Number((recAtend + recExtra - desp).toFixed(2)),
      };
    });
  }, [recebidas, aberto, despesas.data, lab.data, ganhos.data]);


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

      {/* Receitas */}
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Receitas</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Receita de Atendimentos" value={brl(totLiquidoAtend)} tone="primary" icon={<TrendingUp className="h-4 w-4" />} hint={`Bruto ${brl(totBruto)} · apenas pagos`} />
        <StatCard label="Receitas Extras" value={brl(totGanhos)} icon={<CircleDollarSign className="h-4 w-4" />} hint="Aluguel, rendimentos, etc." />
        <StatCard label="Receita Total" value={brl(totReceitaTotal)} tone="success" icon={<CircleDollarSign className="h-4 w-4" />} hint="Atendimentos pagos + extras" />
      </div>

      {/* Contas a Receber */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contas a Receber</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receita Recebida" value={brl(totLiquidoAtend)} tone="success" icon={<HandCoins className="h-4 w-4" />} hint={`${monthLabel(mes)} · caixa`} />
        <StatCard label="Valores em Aberto" value={brl(totPendente)} tone={totPendente > 0 ? "warning" : "success"} icon={<Clock className="h-4 w-4" />} hint={`${qtdPendente} parcela(s) · todos os meses`} />
        <StatCard label="Receita Contratada" value={brl(totContratado)} tone="primary" icon={<FileSignature className="h-4 w-4" />} hint="Recebido + a receber" />
        <StatCard label="Pacientes a Receber" value={String(pacientesPendentes.length)} icon={<Users className="h-4 w-4" />} hint={pacientesPendentes.slice(0, 3).join(", ") || "Nenhum"} />
      </div>


      {/* Resultado */}
      <div className="mt-6 mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resultado</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Lucro Operacional" value={brl(lucroOperacional)} tone={lucroOperacional >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} hint="Só consultório − despesas − lab" />
        <StatCard label="Lucro Geral" value={brl(lucroGeral)} tone={lucroGeral >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} hint="Inclui receitas extras" />
        <StatCard label="Despesas" value={brl(totDesp)} tone="warning" icon={<Receipt className="h-4 w-4" />} hint={`Pagas ${brl(totDespPagas)} · Pend. ${brl(totDespPendentes)}`} />
        <StatCard label="Pendentes" value={brl(totDespPendentes)} tone={totDespPendentes > 0 ? "warning" : "success"} icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard label="Laboratório" value={brl(totLab)} icon={<FlaskConical className="h-4 w-4" />} />
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
              <Bar dataKey="Atendimentos" stackId="rec" fill="var(--chart-1)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Ganhos extras" stackId="rec" fill="var(--chart-3)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Em aberto" fill="var(--destructive)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Despesas" fill="var(--chart-4)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="Lucro geral" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />

            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ProceduresAnalytics mes={mes} />
    </>
  );
}
