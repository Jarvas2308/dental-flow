import { useMemo, useState } from "react";
import { useTable } from "@/hooks/use-data";
import { brl, monthOptions, monthLabel, monthKey } from "@/lib/format";
import { StatCard } from "@/components/ui-kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Activity, CalendarDays, Trophy, Sparkles, Crown, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

type Atendimento = {
  procedimento: string;
  valor_bruto: number | string;
  valor_liquido: number | string;
  data: string;
};

type CustoLab = {
  atendimento_id?: string | null;
  procedimento?: string | null;
  valor: number | string;
  data: string;
};

type ItemProcedimento = {
  atendimento_id: string;
  procedimento?: string | null;
  valor: number | string | null;
};

type Periodo = "mes" | "3m" | "6m" | "12m";

export function ProceduresAnalytics({ mes }: { mes: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [procFiltro, setProcFiltro] = useState<string>("todos");
  const [mesLocal, setMesLocal] = useState<string>(mes);

  const atendimentos = useTable<Atendimento & { id: string }>("atendimentos", "data");
  const itens = useTable<ItemProcedimento>("atendimento_procedimentos", "created_at", true);
  const lab = useTable<CustoLab>("custos_laboratorio", "data");

  const mesesPeriodo = useMemo(() => {
    if (periodo === "mes") return [mesLocal];
    const n = periodo === "3m" ? 3 : periodo === "6m" ? 6 : 12;
    return monthOptions(n);
  }, [periodo, mesLocal]);

  // Linhas de procedimento: usa itens detalhados quando existirem,
  // com fallback para o campo de texto dos atendimentos antigos.
  const lineItems = useMemo(() => {
    const itensPorAtend = new Map<string, ItemProcedimento[]>();
    (itens.data ?? []).forEach((it) => {
      const arr = itensPorAtend.get(it.atendimento_id) ?? [];
      arr.push(it);
      itensPorAtend.set(it.atendimento_id, arr);
    });

    const out: {
      procedimento: string;
      bruto: number;
      liquido: number;
      data: string;
      atendimentoId: string;
      ratio: number;
    }[] = [];
    (atendimentos.data ?? []).forEach((a) => {
      if (!mesesPeriodo.includes(monthKey(a.data))) return;
      const its = itensPorAtend.get(a.id);
      const liqTotal = Number(a.valor_liquido || 0);
      const bruTotal = Number(a.valor_bruto || 0);
      if (its && its.length > 0) {
        const somaItens = its.reduce((s, it) => s + Number(it.valor || 0), 0) || bruTotal || 1;
        its.forEach((it) => {
          const bruto = Number(it.valor || 0);
          const ratio = somaItens > 0 ? bruto / somaItens : 0;
          out.push({
            procedimento: it.procedimento || "—",
            bruto,
            liquido: liqTotal * ratio,
            data: a.data,
            atendimentoId: a.id,
            ratio,
          });
        });
      } else {
        out.push({
          procedimento: a.procedimento || "—",
          bruto: bruTotal,
          liquido: liqTotal,
          data: a.data,
          atendimentoId: a.id,
          ratio: 1,
        });
      }
    });
    return out;
  }, [atendimentos.data, itens.data, mesesPeriodo]);

  const filtrados = useMemo(
    () => lineItems.filter((r) => procFiltro === "todos" || r.procedimento === procFiltro),
    [lineItems, procFiltro],
  );

  const labFiltrado = useMemo(() => {
    return (lab.data ?? []).filter((r) => mesesPeriodo.includes(monthKey(r.data)));
  }, [lab.data, mesesPeriodo]);

  const procedimentosUnicos = useMemo(() => {
    const set = new Set<string>();
    (itens.data ?? []).forEach((r) => r.procedimento && set.add(r.procedimento));
    (atendimentos.data ?? []).forEach((r) => r.procedimento && set.add(r.procedimento));
    return Array.from(set).sort();
  }, [atendimentos.data, itens.data]);

  // KPIs
  const totalProc = filtrados.length;
  const diasUnicos = new Set(filtrados.map((r) => r.data)).size || 1;
  const mediaDia = totalProc / diasUnicos;

  // Agrupar por procedimento
  const agrupado = useMemo(() => {
    // Soma os custos de laboratório por atendimento_id
    const labPorAtend = new Map<string, number>();
    labFiltrado.forEach((r) => {
      if (!r.atendimento_id) return;
      labPorAtend.set(
        r.atendimento_id,
        (labPorAtend.get(r.atendimento_id) ?? 0) + Number(r.valor || 0),
      );
    });

    const map = new Map<
      string,
      { nome: string; qtd: number; bruto: number; liquido: number; lab: number }
    >();
    filtrados.forEach((r) => {
      const k = r.procedimento || "—";
      const cur = map.get(k) ?? { nome: k, qtd: 0, bruto: 0, liquido: 0, lab: 0 };
      cur.qtd += 1;
      cur.bruto += Number(r.bruto || 0);
      cur.liquido += Number(r.liquido || 0);
      // Custo de lab apenas do mesmo atendimento, rateado pelo peso do item
      const labAtend = labPorAtend.get(r.atendimentoId) ?? 0;
      cur.lab += labAtend * Number(r.ratio || 0);
      map.set(k, cur);
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      lucro: r.liquido - r.lab,
      margem: r.bruto > 0 ? ((r.liquido - r.lab) / r.bruto) * 100 : 0,
    }));
  }, [filtrados, labFiltrado]);

  const maisRealizado = [...agrupado].sort((a, b) => b.qtd - a.qtd)[0];
  const maisLucrativo = [...agrupado].sort((a, b) => b.lucro - a.lucro)[0];
  const maiorMargem = [...agrupado]
    .filter((r) => r.qtd >= 1)
    .sort((a, b) => b.margem - a.margem)[0];

  const chartData = [...agrupado].sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  const ranking = [...agrupado].sort((a, b) => b.bruto - a.bruto).slice(0, 10);

  const periodoLabel =
    periodo === "mes"
      ? monthLabel(mesLocal)
      : periodo === "3m"
        ? "Últimos 3 meses"
        : periodo === "6m"
          ? "Últimos 6 meses"
          : "Últimos 12 meses";

  return (
    <div className="mt-10 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Análise de Procedimentos
          </h2>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{periodoLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês específico</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="12m">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          {periodo === "mes" && (
            <Select value={mesLocal} onValueChange={setMesLocal}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions(12).map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {monthLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={procFiltro} onValueChange={setProcFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Procedimento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os procedimentos</SelectItem>
              {procedimentosUnicos.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Procedimentos realizados"
          value={String(totalProc)}
          tone="primary"
          icon={<Activity className="h-4 w-4" />}
          hint={periodo === "mes" ? "no mês selecionado" : "no período"}
        />
        <StatCard
          label="Média por dia"
          value={mediaDia.toFixed(1)}
          icon={<CalendarDays className="h-4 w-4" />}
          hint={`${diasUnicos} ${diasUnicos === 1 ? "dia" : "dias"} com atendimento`}
        />
        <StatCard
          label="Mais realizado"
          value={maisRealizado?.nome ?? "—"}
          tone="success"
          icon={<Trophy className="h-4 w-4" />}
          hint={maisRealizado ? `${maisRealizado.qtd} atendimentos` : "sem dados"}
        />
      </div>

      <div className="rounded-2xl border bg-card p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
        <div className="mb-4">
          <h3 className="font-semibold">Quantidade e faturamento por procedimento</h3>
          <p className="text-xs text-muted-foreground">Top 8 por volume</p>
        </div>
        {chartData.length === 0 ? (
          <div className="h-72 grid place-items-center text-sm text-muted-foreground">
            Nenhum atendimento encontrado no período.
          </div>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="nome"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  yAxisId="left"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
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
                  formatter={(v: number | string, name: string) =>
                    name === "Faturamento" ? brl(Number(v)) : v
                  }
                />
                <Bar
                  yAxisId="left"
                  dataKey="qtd"
                  name="Quantidade"
                  fill="var(--chart-1)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={600}
                />
                <Bar
                  yAxisId="right"
                  dataKey="bruto"
                  name="Faturamento"
                  fill="var(--chart-2)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={800}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InsightCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Mais frequente"
          title={maisRealizado?.nome ?? "—"}
          hint={maisRealizado ? `${maisRealizado.qtd} atendimentos` : ""}
        />
        <InsightCard
          icon={<Crown className="h-4 w-4" />}
          label="Mais lucrativo"
          title={maisLucrativo?.nome ?? "—"}
          hint={maisLucrativo ? `${brl(maisLucrativo.lucro)} de lucro` : ""}
          tone="success"
        />
        <InsightCard
          icon={<Percent className="h-4 w-4" />}
          label="Maior margem líquida"
          title={maiorMargem?.nome ?? "—"}
          hint={maiorMargem ? `${maiorMargem.margem.toFixed(1)}% de margem` : ""}
          tone="primary"
        />
      </div>

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="p-5 border-b">
          <h3 className="font-semibold">Top Procedimentos</h3>
          <p className="text-xs text-muted-foreground">Ranking por faturamento</p>
        </div>
        {ranking.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">#</th>
                  <th className="text-left px-5 py-3 font-medium">Procedimento</th>
                  <th className="text-right px-5 py-3 font-medium">Qtd</th>
                  <th className="text-right px-5 py-3 font-medium">Faturamento</th>
                  <th className="text-right px-5 py-3 font-medium">Lucro líquido</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.nome} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-5 py-3 font-medium">{r.nome}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{r.qtd}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{brl(r.bruto)}</td>
                    <td
                      className={cn(
                        "px-5 py-3 text-right tabular-nums font-medium",
                        r.lucro >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {brl(r.lucro)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({
  icon,
  label,
  title,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  hint?: string;
  tone?: "default" | "primary" | "success";
}) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
  }[tone];
  return (
    <div
      className="rounded-2xl border bg-card p-5 transition-shadow hover:shadow-[var(--shadow-card)]"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className={toneCls}>{icon}</span>
        {label}
      </div>
      <div className={cn("mt-3 text-lg font-semibold tracking-tight truncate", toneCls)}>
        {title}
      </div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}
