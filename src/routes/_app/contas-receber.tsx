import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable } from "@/hooks/use-data";
import { brl, formatDateBR, todayISO } from "@/lib/format";
import {
  contasAReceber,
  valoresEmAberto,
  STATUS_LABEL,
  type RecebimentoRow,
  type ParcelaRow,
} from "@/lib/finance";
import type { Database } from "@/integrations/supabase/types";
import { RegistrarRecebimento } from "@/components/recebimento-form";
import { EditAtendimentoButton } from "@/components/atendimento-form";
import { VerPacienteButton } from "@/components/paciente-link";
import { PageHeader, StatCard, AlertBanner, EmptyState } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  HandCoins,
  CalendarClock,
  Layers,
  Users,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/_app/contas-receber")({
  component: ContasReceber,
});

type NotaFiscalStatus = "pendente" | "emitida" | "nao_emitida" | "nao_se_aplica";
type AtendimentoFull = Omit<
  Database["public"]["Tables"]["atendimentos"]["Row"],
  "nota_fiscal_status"
> & { nota_fiscal_status: NotaFiscalStatus };

function ContasReceber() {
  const [q, setQ] = useState("");
  const atendimentos = useTable<AtendimentoFull>("atendimentos", "data");
  const recebimentos = useTable<RecebimentoRow>("recebimentos", "data", true);
  const parcelas = useTable<ParcelaRow>("parcelas", "vencimento", true);

  const loading = atendimentos.isLoading || recebimentos.isLoading || parcelas.isLoading;

  const contas = useMemo(
    () => contasAReceber(atendimentos.data ?? [], recebimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, recebimentos.data, parcelas.data],
  );

  // Itens efetivamente vencidos (vencimento anterior a hoje) — apenas para o
  // alerta visual; não altera nenhum cálculo financeiro.
  const vencidas = useMemo(() => {
    const hoje = todayISO();
    return valoresEmAberto(
      atendimentos.data ?? [],
      recebimentos.data ?? [],
      parcelas.data ?? [],
    ).filter((v) => v.vencimento && v.vencimento < hoje);
  }, [atendimentos.data, recebimentos.data, parcelas.data]);

  const totalVencido = vencidas.reduce((s, v) => s + v.valor_liquido, 0);

  const rows = useMemo(() => {
    if (!q) return contas;
    const s = q.toLowerCase();
    return contas.filter(
      (c) => c.paciente.toLowerCase().includes(s) || c.procedimento.toLowerCase().includes(s),
    );
  }, [contas, q]);

  const totalSaldo = contas.reduce((s, c) => s + c.saldo, 0);
  const totalRecebido = contas.reduce((s, c) => s + c.recebido, 0);
  const pacientes = new Set(contas.map((c) => c.paciente)).size;

  return (
    <>
      <PageHeader
        title="Valores em Aberto"
        description="Tratamentos com saldo pendente — só entram no caixa quando recebidos"
      />

      {!loading && vencidas.length > 0 && (
        <AlertBanner
          tone="destructive"
          icon={<AlertTriangle className="h-5 w-5" />}
          title={`${vencidas.length} conta(s) a receber vencida(s)`}
          description={`Saldo vencido de ${brl(totalVencido)} aguardando recebimento.`}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Total a receber"
          value={brl(totalSaldo)}
          tone={totalSaldo > 0 ? "warning" : "success"}
          icon={<HandCoins className="h-4 w-4" />}
          hint="Saldo pendente"
        />
        <StatCard
          label="Já recebido (nestes)"
          value={brl(totalRecebido)}
          tone="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Tratamentos abertos"
          value={String(rows.length)}
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Pacientes"
          value={String(pacientes)}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente ou procedimento..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
          <EmptyState
            icon={<CheckCircle2 className="h-8 w-8 text-success" />}
            title={q ? "Nenhum resultado para a busca" : "Nenhuma conta a receber em aberto"}
            description={
              q
                ? "Ajuste o termo buscado para encontrar o paciente ou procedimento."
                : "Tudo em dia! Novos saldos aparecem aqui quando um atendimento fica pendente."
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const pct = c.total > 0 ? Math.min(100, (c.recebido / c.total) * 100) : 0;
            const atend = (atendimentos.data ?? []).find((a) => a.id === c.atendimento_id);
            return (
              <div
                key={c.atendimento_id}
                className="rounded-2xl border bg-card p-4 sm:p-5"
                style={{ boxShadow: "var(--shadow-soft)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{c.paciente || "—"}</h3>
                      {c.parcelasCombinadas > 1 && (
                        <Badge variant="outline" className="gap-1">
                          <CalendarClock className="h-3 w-3" /> {c.parcelasCombinadas} parcelas
                          combinadas
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          c.status === "parcial"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-warning/40 bg-warning/10 text-warning"
                        }
                      >
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.procedimento} · {c.forma_pagamento}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-warning">{brl(c.saldo)}</div>
                    <div className="text-xs text-muted-foreground">saldo de {brl(c.total)}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>
                      Recebido {brl(c.recebido)} · {c.qtd} recebimento(s)
                    </span>
                    <span>Início {formatDateBR(c.data)}</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <VerPacienteButton nome={c.paciente} />
                  {atend ? (
                    <>
                      <EditAtendimentoButton row={atend} />
                      <RegistrarRecebimento
                        atendimento={atend}
                        trigger={
                          <Button size="sm" className="h-8 gap-1">
                            <HandCoins className="h-4 w-4" /> Receber saldo
                          </Button>
                        }
                      />
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> Pendente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
