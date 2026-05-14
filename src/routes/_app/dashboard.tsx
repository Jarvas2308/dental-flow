import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable } from "@/hooks/use-data";
import { brl, monthOptions, monthLabel, currentMonthKey, monthKey } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Wallet, Receipt, FlaskConical, CircleDollarSign,
} from "lucide-react";
import { ProceduresAnalytics } from "@/components/procedures-analytics";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [mes, setMes] = useState(currentMonthKey());
  const opts = monthOptions(12);

  const atendimentos = useTable<any>("atendimentos", "data");
  const despesas = useTable<any>("despesas", "vencimento");
  const lab = useTable<any>("custos_laboratorio", "data");
  const ganhos = useTable<any>("receitas_extras", "data");

  const filt = <T extends { data: string }>(rows: T[] = []) =>
    rows.filter((r) => monthKey(r.data) === mes);

  const filtDesp = (rows: any[] = []) =>
    rows.filter((r) => monthKey(r.vencimento) === mes);

  const totBruto = filt(atendimentos.data).reduce((s, r: any) => s + Number(r.valor_bruto || 0), 0);
  const totLiquidoAtend = filt(atendimentos.data).reduce((s, r: any) => s + Number(r.valor_liquido || 0), 0);
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
      const recAtend = (atendimentos.data ?? []).filter((r: any) => monthKey(r.data) === m)
        .reduce((s, r: any) => s + Number(r.valor_liquido || 0), 0);
      const recExtra = (ganhos.data ?? []).filter((r: any) => monthKey(r.data) === m)
        .reduce((s, r: any) => s + Number(r.valor || 0), 0);
      const desp =
        (despesas.data ?? []).filter((r: any) => monthKey(r.vencimento) === m).reduce((s, r: any) => s + Number(r.valor || 0), 0) +
        (lab.data ?? []).filter((r: any) => monthKey(r.data) === m).reduce((s, r: any) => s + Number(r.valor || 0), 0);
      return {
        mes: monthLabel(m).replace(" de ", "/"),
        Atendimentos: Number(recAtend.toFixed(2)),
        "Ganhos extras": Number(recExtra.toFixed(2)),
        Despesas: Number(desp.toFixed(2)),
        "Lucro geral": Number((recAtend + recExtra - desp).toFixed(2)),
      };
    });
  }, [atendimentos.data, despesas.data, lab.data, ganhos.data]);

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

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Receita Bruta" value={brl(totBruto)} tone="primary" icon={<TrendingUp className="h-4 w-4" />} hint="Atendimentos" />
        <StatCard label="Receita Líquida" value={brl(totLiquido)} tone="success" icon={<CircleDollarSign className="h-4 w-4" />} hint={`Atend. ${brl(totLiquidoAtend)} · Extras ${brl(totGanhos)}`} />
        <StatCard label="Lucro Líquido" value={brl(lucro)} tone={lucro >= 0 ? "success" : "destructive"} icon={<Wallet className="h-4 w-4" />} hint="Receita líq. − despesas − laboratório" />
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
            <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
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
              <Bar dataKey="Lucro" fill="var(--chart-2)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <ProceduresAnalytics mes={mes} />
    </>
  );
}
