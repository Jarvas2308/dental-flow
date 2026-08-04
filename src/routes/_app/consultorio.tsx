import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConsultorioData, useUpdate, useDelete } from "@/hooks/use-data";
import type { Database } from "@/integrations/supabase/types";

type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

type NotaFiscalStatus = "pendente" | "emitida" | "nao_emitida" | "nao_se_aplica";
type AtendimentoView = Omit<Tables<"atendimentos">, "nota_fiscal_status"> & {
  nota_fiscal_status: NotaFiscalStatus;
};
import {
  brl,
  currentMonthKey,
  formatDateBR,
  monthKey,
  parseLocalDate,
  startOfWeek,
} from "@/lib/format";
import { parseMes, parseOpcao, parseTexto } from "@/lib/search-params";
import { PageHeader, StatCard, EmptyState, ErrorState, MonthSelect } from "@/components/ui-kit";
import { VerPacienteButton } from "@/components/paciente-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  FileCheck2,
  Loader2,
  ArrowUpDown,
  Filter,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AtendimentoForm, EditAtendimentoButton } from "@/components/atendimento-form";
import { RegistrarRecebimento } from "@/components/recebimento-form";
import {
  resumoAtendimento,
  receitasRecebidas,
  noMes,
  STATUS_LABEL,
  MONETARY_EPSILON,
} from "@/lib/finance";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { Progress } from "@/components/ui/progress";

type SortKey =
  | "data_desc"
  | "data_asc"
  | "paciente_asc"
  | "paciente_desc"
  | "procedimento"
  | "forma_pagamento"
  | "bruto_desc"
  | "liquido_desc"
  | "nf"
  | "lucrativos"
  | "frequentes";

type QuickFilter =
  | "todos"
  | "hoje"
  | "semana"
  | "mes"
  | "emitidos"
  | "pendentes"
  | "nao_emitidos"
  | "nao_se_aplica"
  | "cartao"
  | "pix"
  | "dinheiro";

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

// As listas de opções saem dos mapas de rótulos acima, então não há um segundo
// lugar para manter em sincronia quando surgir um filtro novo.
const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[];
const FILTER_KEYS = Object.keys(FILTER_LABELS) as QuickFilter[];
const STATUS_KEYS = Object.keys(STATUS_LABELS) as StatusPag[];

// `proc` é texto livre porque a lista de procedimentos é dinâmica; um valor
// desconhecido apenas filtra para zero linhas, que é um resultado correto.
type ConsultorioSearch = {
  mes?: string;
  q?: string;
  sort?: SortKey;
  f?: QuickFilter;
  proc?: string;
  status?: StatusPag;
};

export const Route = createFileRoute("/_app/consultorio")({
  validateSearch: (s: Record<string, unknown>): ConsultorioSearch => ({
    mes: parseMes(s.mes),
    q: parseTexto(s.q),
    sort: parseOpcao(s.sort, SORT_KEYS),
    f: parseOpcao(s.f, FILTER_KEYS),
    proc: parseTexto(s.proc),
    status: parseOpcao(s.status, STATUS_KEYS),
  }),
  component: Consultorio,
});

function Consultorio() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/consultorio" });

  const mes: string = search.mes ?? currentMonthKey();
  const sort = search.sort ?? "data_desc";
  const filter: QuickFilter = search.f ?? "todos";
  const statusPag: StatusPag = search.status ?? "todos";
  // O sentinela "__all__" é detalhe interno do <Select>; na URL a ausência do
  // param já significa "todos os procedimentos".
  const procFilter = search.proc ?? "__all__";

  const setSearch = useCallback(
    (patch: Partial<ConsultorioSearch>) =>
      navigate({ search: (prev: ConsultorioSearch) => ({ ...prev, ...patch }), replace: true }),
    [navigate],
  );

  const setMes = useCallback((novo: string) => setSearch({ mes: novo }), [setSearch]);
  const setSort = useCallback((novo: SortKey) => setSearch({ sort: novo }), [setSearch]);
  const setFilter = useCallback((novo: QuickFilter) => setSearch({ f: novo }), [setSearch]);
  const setStatusPag = useCallback((novo: StatusPag) => setSearch({ status: novo }), [setSearch]);
  const setProcFilter = useCallback(
    (novo: string) => setSearch({ proc: novo === "__all__" ? undefined : novo }),
    [setSearch],
  );

  // A busca fica em estado local e é empurrada para a URL com atraso: navegar a
  // cada tecla digitada travaria a digitação. A filtragem lê o estado local,
  // então continua instantânea; a URL é só a camada de persistência.
  const [qLocal, setQLocal] = useState(search.q ?? "");
  const q = qLocal;
  useEffect(() => {
    setQLocal(search.q ?? "");
  }, [search.q]);
  useEffect(() => {
    const t = setTimeout(() => {
      if ((search.q ?? "") !== qLocal) setSearch({ q: qLocal || undefined });
    }, 300);
    return () => clearTimeout(t);
    // `search.q` fora das deps de propósito: incluí-lo reagendaria o timer a
    // cada navegação e a URL nunca estabilizaria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal, setSearch]);

  const consultorio = useConsultorioData(mes);
  const upd = useUpdate("atendimentos");
  const del = useDelete("atendimentos");
  const [editando, setEditando] = useState<AtendimentoView | null>(null);

  const allData = useMemo(
    () => (consultorio.data?.atendimentos ?? []) as AtendimentoView[],
    [consultorio.data?.atendimentos],
  );
  const recebimentosData = useMemo(
    () => consultorio.data?.recebimentos ?? [],
    [consultorio.data?.recebimentos],
  );
  const parcelasData = useMemo(
    () => consultorio.data?.parcelas ?? [],
    [consultorio.data?.parcelas],
  );

  const resumoMap = useMemo(() => {
    const m = new Map<string, ReturnType<typeof resumoAtendimento>>();
    allData.forEach((a) => m.set(a.id, resumoAtendimento(a, recebimentosData, parcelasData)));
    return m;
  }, [allData, recebimentosData, parcelasData]);

  const isPendente = useCallback(
    (r: AtendimentoView) =>
      (resumoMap.get(r.id)?.status ??
        (r.status_pagamento === "pendente" ? "aberto" : "quitado")) !== "quitado",
    [resumoMap],
  );

  const procedimentosUnicos = useMemo(
    () => Array.from(new Set(allData.map((r) => r.procedimento).filter(Boolean))).sort(),
    [allData],
  );

  const freqMap = useMemo(() => {
    const m = new Map<string, number>();
    allData.forEach((r) => m.set(r.procedimento, (m.get(r.procedimento) ?? 0) + 1));
    return m;
  }, [allData]);

  // Predicado de período (data do RECEBIMENTO), espelhando o filtro temporal da tabela.
  const inPeriodo = useCallback(
    (dateStr: string) => {
      const d = parseLocalDate(dateStr);
      if (!d) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (filter === "hoje") {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return d >= today && d < tomorrow;
      }
      if (filter === "semana") return d >= startOfWeek(today);
      return noMes(dateStr, mes);
    },
    [filter, mes],
  );

  // Atendimentos que receberam dinheiro DENTRO do período selecionado, mesmo
  // que o atendimento em si seja de outro mês e já esteja quitado (ex.:
  // tratamento parcelado feito em junho com a 2ª parcela paga em julho).
  // Sem isso, o dinheiro entra no card "Recebido no período" mas a linha de
  // origem não aparece na tabela.
  const idsComRecebimentoNoPeriodo = useMemo(() => {
    const s = new Set<string>();
    recebimentosData.forEach((r) => {
      if (r.atendimento_id && r.data && inPeriodo(r.data)) s.add(r.atendimento_id);
    });
    parcelasData.forEach((p) => {
      if (p.status !== "pago" || !p.atendimento_id) return;
      const d = p.data_pagamento || p.vencimento;
      if (d && inPeriodo(d)) s.add(p.atendimento_id);
    });
    return s;
  }, [recebimentosData, parcelasData, inPeriodo]);

  const rows = useMemo(() => {
    let r = [...allData];

    // Quick filter (overrides month when temporal)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const weekStart = startOfWeek(today);

    // Fim do mês selecionado — pendentes persistem até a data limite
    const [yy, mm] = mes.split("-").map(Number);
    const monthEnd = new Date(yy, mm, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // Inclui registros do mês, pendentes que continuam em aberto até o mês
    // selecionado, OU atendimentos que receberam dinheiro dentro do período.
    const inMonth = (x: AtendimentoView) => {
      if (monthKey(x.data) === mes) return true;
      if (idsComRecebimentoNoPeriodo.has(x.id)) return true;
      const d = parseLocalDate(x.data);
      return isPendente(x) && !!d && d <= monthEnd;
    };

    if (filter === "hoje") {
      r = r.filter((x) => {
        const d = parseLocalDate(x.data);
        return (
          (!!d && d >= today && d < tomorrow) ||
          isPendente(x) ||
          idsComRecebimentoNoPeriodo.has(x.id)
        );
      });
    } else if (filter === "semana") {
      r = r.filter((x) => {
        const d = parseLocalDate(x.data);
        return (!!d && d >= weekStart) || isPendente(x) || idsComRecebimentoNoPeriodo.has(x.id);
      });
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
      r = r.filter(
        (x) => inMonth(x) && /cart[ãa]o|cr[eé]dito|d[eé]bito/i.test(x.forma_pagamento ?? ""),
      );
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
      r = r.filter(
        (x) =>
          (x.paciente ?? "").toLowerCase().includes(s) ||
          (x.procedimento ?? "").toLowerCase().includes(s),
      );
    }

    const cmp = (a: AtendimentoView, b: AtendimentoView) => {
      switch (sort) {
        case "data_desc":
          return +parseLocalDate(b.data)! - +parseLocalDate(a.data)!;
        case "data_asc":
          return +parseLocalDate(a.data)! - +parseLocalDate(b.data)!;
        case "paciente_asc":
          return (a.paciente ?? "").localeCompare(b.paciente ?? "");
        case "paciente_desc":
          return (b.paciente ?? "").localeCompare(a.paciente ?? "");
        case "procedimento":
          return (a.procedimento ?? "").localeCompare(b.procedimento ?? "");
        case "forma_pagamento":
          return (a.forma_pagamento ?? "").localeCompare(b.forma_pagamento ?? "");
        case "bruto_desc":
          return Number(b.valor_bruto || 0) - Number(a.valor_bruto || 0);
        case "liquido_desc":
          return Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0);
        case "lucrativos":
          return Number(b.valor_liquido || 0) - Number(a.valor_liquido || 0);
        case "nf":
          return (
            (b.nota_fiscal_status === "emitida" ? 1 : 0) -
            (a.nota_fiscal_status === "emitida" ? 1 : 0)
          );
        case "frequentes":
          return (freqMap.get(b.procedimento) ?? 0) - (freqMap.get(a.procedimento) ?? 0);
        default:
          return 0;
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
  }, [
    allData,
    mes,
    q,
    sort,
    filter,
    procFilter,
    statusPag,
    freqMap,
    isPendente,
    idsComRecebimentoNoPeriodo,
  ]);

  // Mesmos filtros de atributo de `rows` (busca, procedimento, status de
  // pagamento, NF/forma do quick-filter), mas SEM excluir pela data do
  // ATENDIMENTO — usado só para o card "Recebido no período" abaixo, que
  // precisa considerar recebimentos cuja própria data caia no período,
  // mesmo quando o atendimento em si é de outro mês (ex.: atendimento
  // parcelado feito em junho, 2ª parcela paga em julho).
  const atendimentosFiltradosSemData = useMemo(() => {
    let r = [...allData];

    if (filter === "emitidos") r = r.filter((x) => x.nota_fiscal_status === "emitida");
    else if (filter === "pendentes")
      r = r.filter((x) => (x.nota_fiscal_status ?? "pendente") === "pendente");
    else if (filter === "nao_emitidos") r = r.filter((x) => x.nota_fiscal_status === "nao_emitida");
    else if (filter === "nao_se_aplica")
      r = r.filter((x) => x.nota_fiscal_status === "nao_se_aplica");
    else if (filter === "cartao")
      r = r.filter((x) => /cart[ãa]o|cr[eé]dito|d[eé]bito/i.test(x.forma_pagamento ?? ""));
    else if (filter === "pix") r = r.filter((x) => /pix/i.test(x.forma_pagamento ?? ""));
    else if (filter === "dinheiro")
      r = r.filter((x) => /dinheiro|esp[eé]cie/i.test(x.forma_pagamento ?? ""));

    if (statusPag === "pagos") r = r.filter((x) => !isPendente(x));
    else if (statusPag === "abertos") r = r.filter((x) => isPendente(x));

    if (procFilter !== "__all__") r = r.filter((x) => x.procedimento === procFilter);

    if (q) {
      const s = q.toLowerCase();
      r = r.filter(
        (x) =>
          (x.paciente ?? "").toLowerCase().includes(s) ||
          (x.procedimento ?? "").toLowerCase().includes(s),
      );
    }

    return r;
  }, [allData, filter, statusPag, procFilter, q, isPendente]);

  // "Recebido no período": soma somente recebimentos cuja DATA pertence ao período,
  // usando os próprios campos (bruto/líquido) de cada recebimento. Não usa o
  // acumulado de resumoAtendimento.
  const recebPeriodo = useMemo(
    () =>
      receitasRecebidas(atendimentosFiltradosSemData, recebimentosData, parcelasData).filter((e) =>
        inPeriodo(e.data),
      ),
    [atendimentosFiltradosSemData, recebimentosData, parcelasData, inPeriodo],
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

  const hasActiveFilter =
    filter !== "todos" || procFilter !== "__all__" || q.length > 0 || statusPag !== "todos";

  // Paginação client-side apenas para renderização (não afeta os totais acima,
  // que continuam somando sobre a lista completa `rows`).
  const pag = usePagination(rows, 20, `${mes}|${q}|${sort}|${filter}|${procFilter}|${statusPag}`);

  return (
    <>
      {editando && <AtendimentoForm editing={editando} onClose={() => setEditando(null)} />}
      <PageHeader
        title="Consultório"
        description="Atendimentos e procedimentos realizados"
        actions={<AtendimentoForm />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Recebido no período (líquido)"
          value={brl(totLiq)}
          tone="success"
          hint={`${qtdReceb} recebimento${qtdReceb === 1 ? "" : "s"} · bruto ${brl(totBruto)}`}
        />
        <StatCard
          label="Em aberto"
          value={brl(totPendente)}
          tone={totPendente > 0 ? "destructive" : "success"}
          icon={<Clock className="h-4 w-4" />}
          hint={`${abertas.length} pendentes`}
        />
        <StatCard
          label="Previsto após receber"
          value={brl(totLiqAcumulado + totPendente)}
          tone="primary"
          hint="Recebido + pendente"
        />
        <StatCard
          label="NFs no período"
          value={`${nfEmitidas} emitidas`}
          icon={<FileCheck2 className="h-4 w-4" />}
          hint={`${nfPendentes} pendentes · ${nfNaoEmitidas} não emitidas · ${nfNaoSeAplica} não se aplica`}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente ou procedimento..."
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            className="pl-9"
          />
        </div>

        <MonthSelect
          value={mes}
          onChange={setMes}
          className="w-[180px]"
          // Os filtros rápidos "hoje"/"semana" têm recorte próprio e ignoram o
          // mês, então o seletor fica desabilitado enquanto um deles está ativo.
          disabled={["hoje", "semana"].includes(filter)}
        />

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
                <DropdownMenuRadioItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </DropdownMenuRadioItem>
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
            <DropdownMenuRadioGroup
              value={statusPag}
              onValueChange={(v) => setStatusPag(v as StatusPag)}
            >
              {(Object.keys(STATUS_LABELS) as StatusPag[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {STATUS_LABELS[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Filtros rápidos</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={filter}
              onValueChange={(v) => setFilter(v as QuickFilter)}
            >
              {(Object.keys(FILTER_LABELS) as QuickFilter[]).map((k) => (
                <DropdownMenuRadioItem key={k} value={k}>
                  {FILTER_LABELS[k]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {procedimentosUnicos.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Procedimento</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={procFilter} onValueChange={setProcFilter}>
                  <DropdownMenuRadioItem value="__all__">Todos</DropdownMenuRadioItem>
                  {procedimentosUnicos.map((p) => (
                    <DropdownMenuRadioItem key={p} value={p}>
                      {p}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            // Uma única navegação: chamar os setters individualmente
            // dispararia quatro entradas de navegação em sequência.
            onClick={() => {
              setQLocal("");
              setSearch({ f: undefined, proc: undefined, q: undefined, status: undefined });
            }}
          >
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
              <button onClick={() => setStatusPag("todos")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filter !== "todos" && (
            <Badge variant="secondary" className="gap-1">
              {FILTER_LABELS[filter]}
              <button onClick={() => setFilter("todos")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {procFilter !== "__all__" && (
            <Badge variant="secondary" className="gap-1">
              {procFilter}
              <button onClick={() => setProcFilter("__all__")}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
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
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {consultorio.isError && !consultorio.isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-0">
                  <ErrorState
                    title="Não foi possível carregar os atendimentos"
                    description="Os totais acima podem estar incompletos. Recarregue para ver os números corretos."
                    onRetry={() => consultorio.refetch()}
                  />
                </TableCell>
              </TableRow>
            )}
            {!consultorio.isLoading && !consultorio.isError && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-0">
                  <EmptyState
                    icon={<Search className="h-8 w-8" />}
                    title={
                      hasActiveFilter
                        ? "Nenhum atendimento para os filtros atuais"
                        : "Nenhum atendimento registrado"
                    }
                    description={
                      hasActiveFilter
                        ? "Ajuste ou limpe os filtros para ver mais atendimentos."
                        : "Use “Novo atendimento” para registrar o primeiro procedimento."
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {pag.pageItems.map((r) => {
              const pend = isPendente(r);
              return (
                <TableRow
                  key={r.id}
                  // Mesma entidade e mesmo gesto do card em Contas a Receber:
                  // clicar na linha abre a edição do atendimento.
                  className={cn(
                    "cursor-pointer",
                    pend && "border-l-4 border-l-destructive hover:bg-muted/40",
                  )}
                  onClick={() => setEditando(r)}
                >
                  <TableCell className={cn("text-muted-foreground", pend && "text-destructive/80")}>
                    {formatDateBR(r.data)}
                  </TableCell>
                  <TableCell className={cn("font-medium", pend && "text-destructive font-semibold")}>
                    {r.paciente}
                  </TableCell>
                  <TableCell className={cn(pend && "text-destructive/90")}>
                    {r.procedimento}
                  </TableCell>
                  <TableCell
                    className={cn("text-muted-foreground text-sm", pend && "text-destructive/70")}
                  >
                    {r.forma_pagamento} · {r.taxa}%
                  </TableCell>
                  <TableCell className={cn("text-right", pend && "text-destructive/80")}>
                    {brl(r.valor_bruto)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium",
                      pend && "text-destructive font-semibold",
                    )}
                  >
                    {brl(r.valor_liquido)}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const rs = resumoMap.get(r.id);
                      if (r.parcelado && rs) {
                        const pct =
                          rs.total > 0 ? Math.min(100, (rs.recebido / rs.total) * 100) : 0;
                        return (
                          <div className="min-w-[140px] space-y-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                rs.status === "quitado"
                                  ? "border-success/40 bg-success/10 text-success"
                                  : rs.status === "parcial"
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-warning/40 bg-warning/10 text-warning",
                              )}
                            >
                              {STATUS_LABEL[rs.status]}
                            </Badge>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                {rs.qtd}/{rs.parcelasCombinadas}
                              </span>
                              <span>Saldo {brl(rs.saldo)}</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      }
                      return pend ? (
                        <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1">
                          <Clock className="h-3 w-3" /> Pendente
                        </Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground hover:bg-success/90 gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Pago
                        </Badge>
                      );
                    })()}
                  </TableCell>
                  {/* O status da NF é editável inline; o clique nele não pode
                      abrir a edição do atendimento junto. */}
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {(() => {
                      const status = (r.nota_fiscal_status ?? "pendente") as string;
                      const label =
                        status === "emitida"
                          ? "Emitida"
                          : status === "nao_emitida"
                            ? "Não emitida"
                            : status === "nao_se_aplica"
                              ? "Não se aplica"
                              : "Pendente";
                      const badge =
                        status === "emitida" ? (
                          <Badge className="bg-success text-success-foreground hover:bg-success/90">
                            Emitida
                          </Badge>
                        ) : (
                          <Badge variant="outline">{label}</Badge>
                        );
                      return (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button>{badge}</button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel>Nota fiscal</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuRadioGroup
                              value={
                                ["emitida", "pendente", "nao_emitida"].includes(status)
                                  ? status
                                  : ""
                              }
                              onValueChange={(v) =>
                                upd.mutate({ id: r.id, values: { nota_fiscal_status: v } })
                              }
                            >
                              <DropdownMenuRadioItem value="emitida">Emitida</DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="pendente">
                                Pendente
                              </DropdownMenuRadioItem>
                              <DropdownMenuRadioItem value="nao_emitida">
                                Não emitida
                              </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    {/* Sem stopPropagation, cada botão daqui abriria também a
                        edição da linha por trás do próprio diálogo. */}
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const rs = resumoMap.get(r.id);
                        if (rs && rs.saldo > MONETARY_EPSILON) {
                          return <RegistrarRecebimento atendimento={r} />;
                        }
                        return null;
                      })()}

                      <VerPacienteButton nome={r.paciente} pacienteId={r.paciente_id} label="" />
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
          unitLabel="atendimentos"
        />
      </div>
    </>
  );
}
