import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useConsultorioData, useUpdate, useDelete } from "@/hooks/use-data";
import { brl, currentMonthKey, formatDateBR, monthKey, monthLabel, monthOptions, parseLocalDate } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Search, FileCheck2, Loader2, ArrowUpDown, Filter, X, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AtendimentoForm, EditAtendimentoButton } from "@/components/atendimento-form";
import { RegistrarRecebimento } from "@/components/recebimento-form";
import { resumoAtendimento, receitasRecebidas, STATUS_LABEL } from "@/lib/finance";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_app/consultorio")({
  component: Consultorio,
});

type SortKey =
  | "data_desc" | "data_asc"
  | "paciente_asc" | "paciente_desc"
  | "procedimento" | "forma_pagamento"
  | "bruto_desc" | "liquido_desc"
  | "nf" | "lucrativos" | "frequentes";

type QuickFilter = "todos" | "hoje" | "semana" | "mes" | "emitidos" | "pendentes" | "nao_emitidos" | "nao_se_aplica" | "cartao" | "pix" | "dinheiro";

type StatusPag = "todos" | "pagos" | "abertos";

const STATUS_LABELS: Record<StatusPag, string> = {
  todos: "Todos os pagamentos",
  pagos: "Somente pagos",
  abertos: "Somente pendentes",
};

const SORT_LABELS: Record<SortKey, string> = {
  data_desc: "Data (mais recente)",
  data_asc: "Data (mais antiga)",
  paciente_asc: "Paciente A-Z",
  paciente_desc: "Paciente Z-A",
  procedimento: "Procedimento",
  forma_pagamento: "Forma de pagamento",
  bruto_desc: "Maior valor bruto",
  liquido_desc: "Maior valor líquido",
  nf: "Nota fiscal (emitidos primeiro)",
  lucrativos: "Mais lucrativos",
  frequentes: "Procedimentos mais frequentes",
};

const FILTER_LABELS: Record<QuickFilter, string> = {
  todos: "Todos",
  hoje: "Hoje",
  semana: "Esta semana",
  mes: "Este mês",
  emitidos: "NF Emitidas",
  pendentes: "NF Pendentes",
  nao_emitidos: "NF Não emitidas",
  nao_se_aplica: "NF Não se aplica",
  cartao: "Cartão",
  pix: "PIX",
  dinheiro: "Dinheiro",
};

function startOfWeek(d: Date) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function Consultorio() {
  const [mes, setMes] = useState(currentMonthKey());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("data_desc");
  const [filter, setFilter] = useState<QuickFilter>("todos");
  const [procFilter, setProcFilter] = useState<string>("__all__");
  const [statusPag, setStatusPag] = useState<StatusPag>("todos");

  const consultorio = useConsultorioData(mes);
  const upd = useUpdate("atendimentos");
  const del = useDelete("atendimentos");

  const allData = (consultorio.data?.atendimentos ?? []) as any[];
  const recebimentosData = (consultorio.data?.recebimentos ?? []) as any[];
  const parcelasData = (consultorio.data?.parcelas ?? []) as any[];

  const resumoMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof resumoAtendimento>>();
    allData.forEach((a: any) => m.set(a.id, resumoAtendimento(a, recebimentosData, parcelasData)));
    return m;
  }, [allData, recebimentosData, parcelasData]);

  const isPendente = (r: any) => (resumoMap.get(r.id)?.status ?? (r.status_pagamento === "pendente" ? "aberto" : "quitado")) !== "quitado";



  const procedimentosUnicos = useMemo(
    () => Array.from(new Set(allData.map((r: any) => r.procedimento).filter(Boolean))).sort(),
    [allData],
  );

  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    allData.forEach((r: any) => m.set(r.procedimento, (m.get(r.procedimento) ?? 0) + 1));
    return m;
  }, [allData]);

  const rows = useMemo(() => {
    let r = [...allData];

    // Quick filter (overrides month when temporal)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const weekStart = startOfWeek(today);

    // Fim do mês selecionado — pendentes persistem até a data limite
    const [yy, mm] = mes.split("-").map(Number);
    const monthEnd = new Date(yy, mm, 0); monthEnd.setHours(23, 59, 59, 999);

    // Inclui registros do mês OU pendentes que continuam em aberto até o mês selecionado
    const inMonth = (x: any) => {
      if (monthKey(x.data) === mes) return true;
      const d = parseLocalDate(x.data);
      return isPendente(x) && !!d && d <= monthEnd;
    };

    if (filter === "hoje") {
      r = r.filter((x) => { const d = parseLocalDate(x.data); return (!!d && d >= today && d < tomorrow) || isPendente(x); });
    } else if (filter === "semana") {
      r = r.filter((x) => { const d = parseLocalDate(x.data); return (!!d && d >= weekStart) || isPendente(x); });
    } else if (filter === "mes" || filter === "todos") {
      r = r.filter(inMonth);
    } else if (filter === "emitidos") {
      r = r.filter((x) => inMonth(x) && x.nota_fiscal_status === "emitida");
    } else if (filter === "pendentes") {
      r = r.filter((x) => inMonth(x) && (x.nota_fiscal_status ?? "pendente") === "pendente");
    } else if (filter === "nao_emitidos") {
      r = r.filter((x) => inMonth(x) && x.nota_fiscal_status === "nao_emitida");
    } else if (filter === "nao_se_aplica") {
      r = r.filter((x) => inMonth(x) && x.nota_fiscal_status === "nao_se_aplica");
    } else if (filter === "cartao") {
      r = r.filter((x) => inMonth(x) && /cart[ãa]o|cr[eé]dito|d[eé]bito/i.test(x.forma_pagamento ?? ""));
    } else if (filter === "pix") {
      r = r.filter((x) => inMonth(x) && /pix/i.test(x.forma_pagamento ?? ""));
    } else if (filter === "dinheiro") {
      r = r.filter((x) => inMonth(x) && /dinheiro|esp[eé]cie/i.test(x.forma_pagamento ?? ""));
    }

    if (statusPag === "pagos") r = r.filter((x) => !isPendente(x));
    else if (statusPag === "abertos") r = r.filter((x) => isPendente(x));

    if (procFilter !== "__all__") {
      r = r.filter((x) => x.procedimento === procFilter);
    }

    if (q) {
      const s = q.toLowerCase();
      r = r.filter((x) =>
        (x.paciente ?? "").toLowerCase().includes(s) ||
        (x.procedimento ?? "").toLowerCase().includes(s),
      );
    }

    const cmp = (a: any, b: any) => {
      switch (sort) {
        case "data_desc": return +parseLocalDate(b.data)! - +parseLocalDate(a.data)!;
        case "data_asc": return +parseLocalDate(a.data)! - +parseLocalDate(b.data)!;
        case "paciente_asc": return (a.paciente ?? "").localeCompare(b.paciente ?? "");
        case "paciente_desc": return (b.paciente ?? "").localeCompare(a.paciente ?? "");
        case "procedimento": return (a.procedimento ?? "").localeCompare(b.procedimento ?? "");
        case "forma_pagamento": return (a.forma_pagamento ?? "").localeCompare(b.forma_pagamento ?? "");
        case "bruto_desc": return Number(b.valor_bruto || 0) - Number(a.valor_bruto || 0);
        case "liquido_desc": return Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0);
        case "lucrativos": return Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0);
        case "nf": return (b.nota_fiscal_status === "emitida" ? 1 : 0) - (a.nota_fiscal_status === "emitida" ? 1 : 0);
        case "frequentes": return (freqMap.get(b.procedimento) ?? 0) - (freqMap.get(a.procedimento) ?? 0);
        default: return 0;
      }
    };
    // Prioridade máxima: pendentes sempre primeiro, depois ordenação normal
    r.sort((a, b) => {
      const pa = isPendente(a) ? 0 : 1;
      const pb = isPendente(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return cmp(a, b);
    });
    return r;
  }, [allData, mes, q, sort, filter, procFilter, statusPag, freqMap]);


  // Predicado de período (data do RECEBIMENTO), espelhando o filtro temporal da tabela.
  const inPeriodo = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    if (!d) return false;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (filter === "hoje") {
      const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
      return d >= today && d < tomorrow;
    }
    if (filter === "semana") return d >= startOfWeek(today);
    return monthKey(dateStr) === mes;
  };

  // "Recebido no período": soma somente recebimentos cuja DATA pertence ao período,
  // usando os próprios campos (bruto/líquido) de cada recebimento. Não usa o
  // acumulado de resumoAtendimento.
  const recebPeriodo = useMemo(
    () => receitasRecebidas(rows, recebimentosData, parcelasData).filter((e) => inPeriodo(e.data)),
    [rows, recebimentosData, parcelasData, filter, mes],
  );
  const totBruto = recebPeriodo.reduce((s, e) => s + e.valor_bruto, 0);
  const totLiq = recebPeriodo.reduce((s, e) => s + e.valor_liquido, 0);
  const qtdReceb = recebPeriodo.length;

  // Acumulado (todos os recebimentos das linhas) — preservado para "Previsto após receber".
  const totLiqAcumulado = rows.reduce((s, r) => s + (resumoMap.get(r.id)?.recebidoLiquido ?? 0), 0);
  const totPendente = rows.reduce((s, r) => s + (resumoMap.get(r.id)?.saldoLiquido ?? 0), 0);
  
  const abertas = rows.filter((r) => isPendente(r));

  // Totais de nota fiscal no período/filtro selecionado.
  const nfCount = (status: string) =>
    rows.filter((r) => (r.nota_fiscal_status ?? "pendente") === status).length;
  const nfEmitidas = nfCount("emitida");
  const nfPendentes = nfCount("pendente");
  const nfNaoEmitidas = nfCount("nao_emitida");
  const nfNaoSeAplica = nfCount("nao_se_aplica");


  const hasActiveFilter = filter !== "todos" || procFilter !== "__all__" || q.length > 0 || statusPag !== "todos";

  return (
    <>
      <PageHeader title="Consultório" description="Atendimentos e procedimentos realizados"
        actions={<AtendimentoForm />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Recebido no período (líquido)" value={brl(totLiq)} tone="success" hint={`${qtdReceb} recebimento${qtdReceb === 1 ? "" : "s"} · bruto ${brl(totBruto)}`} />
        <StatCard label="Em aberto" value={brl(totPendente)} tone={totPendente > 0 ? "destructive" : "success"} icon={<Clock className="h-4 w-4" />} hint={`${abertas.length} pendentes`} />
        <StatCard label="Previsto após receber" value={brl(totLiqAcumulado + totPendente)} tone="primary" hint="Recebido + pendente" />
        <StatCard label="NFs no período" value={`${nfEmitidas} emitidas`} icon={<FileCheck2 className="h-4 w-4" />} hint={`${nfPendentes} pendentes · ${nfNaoEmitidas} não emitidas · ${nfNaoSeAplica} não se aplica`} />
      </div>


      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente ou procedimento..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={mes} onValueChange={setMes} disabled={!["todos", "mes", "emitidos", "pendentes", "nao_emitidos", "nao_se_aplica", "cartao", "pix", "dinheiro"].includes(filter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions(12).map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <ArrowUpDown className="h-4 w-4" /> Ordenar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>{SORT_LABELS[k]}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" /> Filtrar
              {hasActiveFilter && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Status de pagamento</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={statusPag} onValueChange={(v) => setStatusPag(v as StatusPag)}>
              {(Object.keys(STATUS_LABELS) as StatusPag[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>{STATUS_LABELS[k]}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filtros rápidos</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={filter} onValueChange={(v) => setFilter(v as QuickFilter)}>
              {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>{FILTER_LABELS[k]}</DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {procedimentosUnicos.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Procedimento</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={procFilter} onValueChange={setProcFilter}>
                  <DropdownMenuRadioItem value="__all__">Todos</DropdownMenuRadioItem>
                  {procedimentosUnicos.map((p) => (
                    <DropdownMenuRadioItem key={p} value={p}>{p}</DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setFilter("todos"); setProcFilter("__all__"); setQ(""); setStatusPag("todos"); }}>
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
      </div>

      {/* Active chips */}
      {hasActiveFilter && (
        <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
          {statusPag !== "todos" && (
            <Badge variant="secondary" className="gap-1">
              {STATUS_LABELS[statusPag]}
              <button onClick={() => setStatusPag("todos")}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filter !== "todos" && (
            <Badge variant="secondary" className="gap-1">
              {FILTER_LABELS[filter]}
              <button onClick={() => setFilter("todos")}><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {procFilter !== "__all__" && (
            <Badge variant="secondary" className="gap-1">
              {procFilter}
              <button onClick={() => setProcFilter("__all__")}><X className="h-3 w-3" /></button>
            </Badge>
          )}
        </div>
      )}


      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Procedimento</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>NF</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consultorio.isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            )}
            {!consultorio.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">Nenhum atendimento encontrado.</TableCell></TableRow>
            )}
            {rows.map((r) => {
              const pend = isPendente(r);
              return (
              <TableRow key={r.id} className={cn(pend && "bg-destructive/5 hover:bg-destructive/10")}>
                <TableCell className={cn("text-muted-foreground", pend && "text-destructive/80")}>{formatDateBR(r.data)}</TableCell>
                <TableCell className={cn("font-medium", pend && "text-destructive")}>{r.paciente}</TableCell>
                <TableCell className={cn(pend && "text-destructive/90")}>{r.procedimento}</TableCell>
                <TableCell className={cn("text-muted-foreground text-sm", pend && "text-destructive/70")}>{r.forma_pagamento} · {r.taxa}%</TableCell>
                <TableCell className={cn("text-right", pend && "text-destructive/80")}>{brl(r.valor_bruto)}</TableCell>
                <TableCell className={cn("text-right font-medium", pend && "text-destructive")}>{brl(r.valor_liquido)}</TableCell>
                <TableCell>
                  {(() => {
                    const rs = resumoMap.get(r.id);
                    if (r.parcelado && rs) {
                      const pct = rs.total > 0 ? Math.min(100, (rs.recebido / rs.total) * 100) : 0;
                      return (
                        <div className="min-w-[140px] space-y-1">
                          <Badge variant="outline" className={cn(
                            rs.status === "quitado" ? "border-success/40 bg-success/10 text-success"
                              : rs.status === "parcial" ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-warning/40 bg-warning/10 text-warning",
                          )}>
                            {STATUS_LABEL[rs.status]}
                          </Badge>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>{rs.qtd}/{rs.parcelasCombinadas}</span>
                            <span>Saldo {brl(rs.saldo)}</span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    }
                    return pend ? (
                      <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive gap-1">
                        <Clock className="h-3 w-3" /> Pendente
                      </Badge>
                    ) : (
                      <Badge className="bg-success text-success-foreground hover:bg-success/90 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Pago
                      </Badge>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  {(() => {
                    const status = (r.nota_fiscal_status ?? "pendente") as string;
                    const label = status === "emitida" ? "Emitida"
                      : status === "nao_emitida" ? "Não emitida"
                      : status === "nao_se_aplica" ? "Não se aplica"
                      : "Pendente";
                    const badge = status === "emitida"
                      ? <Badge className="bg-success text-success-foreground hover:bg-success/90">Emitida</Badge>
                      : <Badge variant="outline">{label}</Badge>;
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button>{badge}</button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                          <DropdownMenuLabel>Nota fiscal</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuRadioGroup
                            value={["emitida", "pendente", "nao_emitida"].includes(status) ? status : ""}
                            onValueChange={(v) => upd.mutate({ id: r.id, values: { nota_fiscal_status: v } })}
                          >
                            <DropdownMenuRadioItem value="emitida">Emitida</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="pendente">Pendente</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="nao_emitida">Não emitida</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {(() => {
                      const rs = resumoMap.get(r.id);
                      if (rs && rs.saldo > 0.005) {
                        return <RegistrarRecebimento atendimento={r} />;
                      }
                      return null;
                    })()}

                    <EditAtendimentoButton row={r} />
                    <ConfirmDelete
                      title="Excluir atendimento?"
                      description={`O atendimento de ${r.paciente} será removido permanentemente.`}
                      onConfirm={() => del.mutate(r.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
