import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useUpdate, useDelete } from "@/hooks/use-data";
import { brl, currentMonthKey, monthKey, monthLabel, monthOptions } from "@/lib/format";
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
import { Search, FileCheck2, Loader2, ArrowUpDown, Filter, X } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AtendimentoForm, EditAtendimentoButton } from "@/components/atendimento-form";

export const Route = createFileRoute("/_app/consultorio")({
  component: Consultorio,
});

type SortKey =
  | "data_desc" | "data_asc"
  | "paciente_asc" | "paciente_desc"
  | "procedimento" | "forma_pagamento"
  | "bruto_desc" | "liquido_desc"
  | "nf" | "lucrativos" | "frequentes";

type QuickFilter = "todos" | "hoje" | "semana" | "mes" | "emitidos" | "pendentes" | "cartao" | "pix" | "dinheiro";

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

  const list = useTable<any>("atendimentos", "data");
  const upd = useUpdate("atendimentos");
  const del = useDelete("atendimentos");

  const allData = list.data ?? [];

  const procedimentosUnicos = useMemo(
    () => Array.from(new Set(allData.map((r) => r.procedimento).filter(Boolean))).sort(),
    [allData],
  );

  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    allData.forEach((r) => m.set(r.procedimento, (m.get(r.procedimento) ?? 0) + 1));
    return m;
  }, [allData]);

  const rows = useMemo(() => {
    let r = [...allData];

    // Quick filter (overrides month when temporal)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const weekStart = startOfWeek(today);

    if (filter === "hoje") {
      r = r.filter((x) => { const d = new Date(x.data); return d >= today && d < tomorrow; });
    } else if (filter === "semana") {
      r = r.filter((x) => new Date(x.data) >= weekStart);
    } else if (filter === "mes" || filter === "todos") {
      r = r.filter((x) => monthKey(x.data) === mes);
    } else if (filter === "emitidos") {
      r = r.filter((x) => monthKey(x.data) === mes && x.nota_fiscal);
    } else if (filter === "pendentes") {
      r = r.filter((x) => monthKey(x.data) === mes && !x.nota_fiscal);
    } else if (filter === "cartao") {
      r = r.filter((x) => monthKey(x.data) === mes && /cart[ãa]o|cr[eé]dito|d[eé]bito/i.test(x.forma_pagamento ?? ""));
    } else if (filter === "pix") {
      r = r.filter((x) => monthKey(x.data) === mes && /pix/i.test(x.forma_pagamento ?? ""));
    } else if (filter === "dinheiro") {
      r = r.filter((x) => monthKey(x.data) === mes && /dinheiro|esp[eé]cie/i.test(x.forma_pagamento ?? ""));
    }

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
        case "data_desc": return +new Date(b.data) - +new Date(a.data);
        case "data_asc": return +new Date(a.data) - +new Date(b.data);
        case "paciente_asc": return (a.paciente ?? "").localeCompare(b.paciente ?? "");
        case "paciente_desc": return (b.paciente ?? "").localeCompare(a.paciente ?? "");
        case "procedimento": return (a.procedimento ?? "").localeCompare(b.procedimento ?? "");
        case "forma_pagamento": return (a.forma_pagamento ?? "").localeCompare(b.forma_pagamento ?? "");
        case "bruto_desc": return Number(b.valor_bruto || 0) - Number(a.valor_bruto || 0);
        case "liquido_desc": return Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0);
        case "lucrativos": return Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0);
        case "nf": return Number(b.nota_fiscal) - Number(a.nota_fiscal);
        case "frequentes": return (freqMap.get(b.procedimento) ?? 0) - (freqMap.get(a.procedimento) ?? 0);
        default: return 0;
      }
    };
    r.sort(cmp);
    return r;
  }, [allData, mes, q, sort, filter, procFilter, freqMap]);

  const totBruto = rows.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
  const totLiq = rows.reduce((s, r) => s + Number(r.valor_liquido || 0), 0);
  const totNF = rows.filter((r) => r.nota_fiscal).length;

  const hasActiveFilter = filter !== "todos" || procFilter !== "__all__" || q.length > 0;

  return (
    <>
      <PageHeader title="Consultório" description="Atendimentos e procedimentos realizados"
        actions={<AtendimentoForm />}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Bruto" value={brl(totBruto)} tone="primary" hint={`${rows.length} atendimentos`} />
        <StatCard label="Líquido" value={brl(totLiq)} tone="success" hint="Após taxas" />
        <StatCard label="NFs emitidas" value={`${totNF} de ${rows.length}`} icon={<FileCheck2 className="h-4 w-4" />} />
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

        <Select value={mes} onValueChange={setMes} disabled={!["todos", "mes", "emitidos", "pendentes", "cartao", "pix", "dinheiro"].includes(filter)}>
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
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setFilter("todos"); setProcFilter("__all__"); setQ(""); }}>
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
      </div>

      {/* Active chips */}
      {hasActiveFilter && (
        <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
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
              <TableHead>NF</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Nenhum atendimento encontrado.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{formatDateBR(r.data)}</TableCell>
                <TableCell className="font-medium">{r.paciente}</TableCell>
                <TableCell>{r.procedimento}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.forma_pagamento} · {r.taxa}%</TableCell>
                <TableCell className="text-right">{brl(r.valor_bruto)}</TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor_liquido)}</TableCell>
                <TableCell>
                  <button onClick={() => upd.mutate({ id: r.id, values: { nota_fiscal: !r.nota_fiscal } })}>
                    {r.nota_fiscal
                      ? <Badge className="bg-success text-success-foreground hover:bg-success/90">Emitida</Badge>
                      : <Badge variant="outline">Pendente</Badge>}
                  </button>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <EditAtendimentoButton row={r} />
                    <ConfirmDelete
                      title="Excluir atendimento?"
                      description={`O atendimento de ${r.paciente} será removido permanentemente.`}
                      onConfirm={() => del.mutate(r.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
