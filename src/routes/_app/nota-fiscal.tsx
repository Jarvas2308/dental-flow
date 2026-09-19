import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { useTable, useUpdate } from "@/hooks/use-data";
import {
  brl,
  currentMonthKey,
  formatDateBR,
  monthKey,
  monthLabel,
  monthOptions,
} from "@/lib/format";
import { parseMes, parseOpcao, parseTexto } from "@/lib/search-params";
import {
  resumosPorAtendimento,
  type AtendimentoRow,
  type RecebimentoRow,
  type ParcelaRow,
} from "@/lib/finance";
import {
  PageHeader,
  StatCard,
  MonthSelect,
  AlertBanner,
  EmptyState,
  ErrorState,
} from "@/components/ui-kit";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { EditAtendimentoButton } from "@/components/atendimento-form";
import { VerPacienteButton } from "@/components/paciente-link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Database } from "@/integrations/supabase/types";
import { Search, Loader2, FileText, FileCheck2, FileClock, AlertTriangle } from "lucide-react";

// Status de NF possíveis. A ausência do campo conta como "pendente", que é o
// padrão do banco para atendimento antigo.
const NF_STATUS = ["pendente", "emitida", "nao_emitida", "nao_se_aplica"] as const;
type NfStatus = (typeof NF_STATUS)[number];

const NF_LABEL: Record<NfStatus, string> = {
  pendente: "Pendente",
  emitida: "Emitida",
  nao_emitida: "Não emitida",
  nao_se_aplica: "Não se aplica",
};

const ABAS = ["pendente", "emitida", "nao_emitida", "nao_se_aplica", "todas"] as const;
type Aba = (typeof ABAS)[number];

type AtendimentoNf = Omit<
  Database["public"]["Tables"]["atendimentos"]["Row"],
  "nota_fiscal_status"
> & { nota_fiscal_status: NfStatus | null };

const nfDe = (a: { nota_fiscal_status?: string | null }): NfStatus =>
  (NF_STATUS as readonly string[]).includes(a.nota_fiscal_status ?? "")
    ? (a.nota_fiscal_status as NfStatus)
    : "pendente";

type NotaFiscalSearch = { mes?: string; aba?: Aba; q?: string };

export const Route = createFileRoute("/_app/nota-fiscal")({
  validateSearch: (s: Record<string, unknown>): NotaFiscalSearch => ({
    mes: parseMes(s.mes),
    aba: parseOpcao(s.aba, ABAS),
    q: parseTexto(s.q),
  }),
  component: NotaFiscalPage,
});

function NotaFiscalPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/nota-fiscal" });

  const mes = search.mes ?? currentMonthKey();
  const aba: Aba = search.aba ?? "pendente";
  const q = search.q ?? "";

  const setSearch = useCallback(
    (patch: Partial<NotaFiscalSearch>) =>
      navigate({
        search: (prev: NotaFiscalSearch) => ({ ...prev, ...patch }),
        replace: true,
      }),
    [navigate],
  );

  const atendimentos = useTable<AtendimentoNf>("atendimentos", "data");
  const recebimentos = useTable<RecebimentoRow>("recebimentos", "data", true);
  const parcelas = useTable<ParcelaRow>("parcelas", "vencimento", true);
  const upd = useUpdate("atendimentos");

  const loading = atendimentos.isLoading || recebimentos.isLoading || parcelas.isLoading;
  const erro = atendimentos.isError || recebimentos.isError || parcelas.isError;
  const recarregar = () => {
    atendimentos.refetch();
    recebimentos.refetch();
    parcelas.refetch();
  };

  const todos = useMemo(() => atendimentos.data ?? [], [atendimentos.data]);

  // Quanto já entrou em cada atendimento. A NF acompanha o atendimento, mas
  // quem decide quando emitir olha o dinheiro que efetivamente entrou — mesma
  // conta usada no Consultório e em Valores em Aberto.
  const resumos = useMemo(
    () =>
      resumosPorAtendimento(
        todos as unknown as AtendimentoRow[],
        recebimentos.data ?? [],
        parcelas.data ?? [],
      ),
    [todos, recebimentos.data, parcelas.data],
  );

  // Recorte pela data do ATENDIMENTO: é a competência do documento fiscal.
  const doMes = useMemo(() => todos.filter((a) => monthKey(a.data) === mes), [todos, mes]);

  const rows = useMemo(
    () =>
      doMes
        .filter((a) => (aba === "todas" ? true : nfDe(a) === aba))
        .filter((a) => {
          if (!q) return true;
          const s = q.toLowerCase();
          return (
            (a.paciente ?? "").toLowerCase().includes(s) ||
            (a.procedimento ?? "").toLowerCase().includes(s)
          );
        })
        .sort((a, b) => (a.data ?? "").localeCompare(b.data ?? "")),
    [doMes, aba, q],
  );

  const pag = usePagination(rows, 20, `${mes}|${aba}|${q}`);

  // Contagem e valor por status, sobre o mês inteiro (não sobre a página).
  const porStatus = useMemo(() => {
    const base = Object.fromEntries(
      NF_STATUS.map((s) => [s, { qtd: 0, bruto: 0, recebido: 0 }]),
    ) as Record<NfStatus, { qtd: number; bruto: number; recebido: number }>;
    for (const a of doMes) {
      const alvo = base[nfDe(a)];
      alvo.qtd += 1;
      alvo.bruto += Number(a.valor_bruto || 0);
      alvo.recebido += resumos.get(a.id)?.recebido ?? 0;
    }
    return base;
  }, [doMes, resumos]);

  // Pendências de meses ANTERIORES ao selecionado. É o buraco que esta tela
  // existe para fechar: uma NF esquecida não reaparece em nenhuma outra tela.
  const atrasadas = useMemo(
    () => todos.filter((a) => nfDe(a) === "pendente" && monthKey(a.data) < mes),
    [todos, mes],
  );
  const brutoAtrasado = atrasadas.reduce((s, a) => s + Number(a.valor_bruto || 0), 0);

  // Pendentes por mês nos últimos 12 meses — a visão de "o que falta emitir".
  const porMes = useMemo(() => {
    const meses = monthOptions(12);
    const acc = new Map(meses.map((m) => [m, { qtd: 0, bruto: 0 }]));
    for (const a of todos) {
      if (nfDe(a) !== "pendente") continue;
      const alvo = acc.get(monthKey(a.data));
      if (!alvo) continue;
      alvo.qtd += 1;
      alvo.bruto += Number(a.valor_bruto || 0);
    }
    return meses.map((m) => ({ mes: m, ...acc.get(m)! })).filter((r) => r.qtd > 0);
  }, [todos]);

  return (
    <>
      <PageHeader
        title="Nota Fiscal"
        description="Atendimentos por situação de emissão, com o total a emitir no mês"
        actions={<MonthSelect value={mes} onChange={(novo) => setSearch({ mes: novo })} />}
      />

      {!loading && atrasadas.length > 0 && (
        <AlertBanner
          tone="destructive"
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`${atrasadas.length} nota(s) pendente(s) de meses anteriores`}
          description={`${brl(brutoAtrasado)} em atendimentos anteriores a ${monthLabel(mes)} ainda sem nota emitida.`}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="A emitir no mês"
          value={brl(porStatus.pendente.bruto)}
          tone={porStatus.pendente.qtd > 0 ? "warning" : "success"}
          icon={<FileClock className="h-4 w-4" />}
          hint={`${porStatus.pendente.qtd} atendimento(s)`}
        />
        <StatCard
          label="Recebido nos pendentes"
          value={brl(porStatus.pendente.recebido)}
          icon={<FileText className="h-4 w-4" />}
          hint="Valor que já entrou no caixa"
        />
        <StatCard
          label="Emitidas no mês"
          value={brl(porStatus.emitida.bruto)}
          tone="success"
          icon={<FileCheck2 className="h-4 w-4" />}
          hint={`${porStatus.emitida.qtd} atendimento(s)`}
        />
        <StatCard
          label="Fora do escopo"
          value={String(porStatus.nao_emitida.qtd + porStatus.nao_se_aplica.qtd)}
          icon={<FileText className="h-4 w-4" />}
          hint="Não emitidas + não se aplica"
        />
      </div>

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente ou procedimento..."
          value={q}
          onChange={(e) => setSearch({ q: e.target.value || undefined })}
          className="pl-9"
        />
      </div>

      <Tabs value={aba} onValueChange={(v) => setSearch({ aba: v as Aba })}>
        <TabsList>
          <TabsTrigger value="pendente">Pendentes ({porStatus.pendente.qtd})</TabsTrigger>
          <TabsTrigger value="emitida">Emitidas ({porStatus.emitida.qtd})</TabsTrigger>
          <TabsTrigger value="nao_emitida">Não emitidas</TabsTrigger>
          <TabsTrigger value="nao_se_aplica">Não se aplica</TabsTrigger>
          <TabsTrigger value="todas">Todas ({doMes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={aba} className="mt-4">
          <div
            className="rounded-xl border bg-card overflow-hidden"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            {loading ? (
              <div className="grid place-items-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : erro ? (
              <ErrorState
                title="Não foi possível carregar os atendimentos"
                description="Os totais acima podem estar incompletos. Recarregue para ver os números corretos."
                onRetry={recarregar}
              />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 className="h-8 w-8 text-success" />}
                title={
                  q ? "Nenhum resultado para a busca" : `Nada nesta situação em ${monthLabel(mes)}`
                }
                description={
                  q
                    ? "Ajuste o termo buscado para encontrar o paciente ou procedimento."
                    : "Troque de aba ou de mês para ver outros atendimentos."
                }
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Procedimento</TableHead>
                      <TableHead className="text-right">Bruto</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead>Nota fiscal</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pag.pageItems.map((a) => {
                      const recebido = resumos.get(a.id)?.recebido ?? 0;
                      const status = nfDe(a);
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDateBR(a.data)}
                          </TableCell>
                          <TableCell className="font-medium">{a.paciente || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {a.procedimento || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {brl(Number(a.valor_bruto || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            {brl(recebido)}
                            {recebido <= 0 && (
                              <Badge variant="outline" className="ml-2">
                                sem entrada
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {/* Editável na linha: a situação da NF muda com
                                frequência e abrir o formulário inteiro para
                                trocar um campo é atrito puro. */}
                            <Select
                              value={status}
                              onValueChange={(v) =>
                                upd.mutate({ id: a.id, values: { nota_fiscal_status: v } })
                              }
                            >
                              <SelectTrigger className="w-[150px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {NF_STATUS.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {NF_LABEL[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <VerPacienteButton
                                nome={a.paciente}
                                pacienteId={a.paciente_id}
                                label=""
                              />
                              {/* O formulário exige um status concreto; a
                                  linha antiga sem valor entra como "pendente",
                                  mesmo padrão aplicado por `nfDe`. */}
                              <EditAtendimentoButton row={{ ...a, nota_fiscal_status: status }} />
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
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {!loading && porMes.length > 0 && (
        <div
          className="mt-6 rounded-xl border bg-card overflow-hidden"
          style={{ boxShadow: "var(--shadow-soft)" }}
        >
          <div className="px-4 py-3 border-b">
            <h2 className="font-semibold">Pendentes por mês</h2>
            <p className="text-sm text-muted-foreground">
              Últimos 12 meses — clique no mês para abrir a lista
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Atendimentos</TableHead>
                <TableHead className="text-right">Valor a emitir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porMes.map((r) => (
                <TableRow
                  key={r.mes}
                  className="cursor-pointer"
                  onClick={() => setSearch({ mes: r.mes, aba: "pendente" })}
                >
                  <TableCell className="capitalize">{monthLabel(r.mes)}</TableCell>
                  <TableCell className="text-right">{r.qtd}</TableCell>
                  <TableCell className="text-right font-medium text-warning">
                    {brl(r.bruto)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
