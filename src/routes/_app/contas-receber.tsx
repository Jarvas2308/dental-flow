import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useUpdate } from "@/hooks/use-data";
import { brl, formatDateBR } from "@/lib/format";
import { contasAReceber, valoresEmAberto } from "@/lib/finance";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Search, Loader2, CheckCircle2, Clock, HandCoins, CalendarClock, Layers,
} from "lucide-react";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contas-receber")({
  component: ContasReceber,
});

function ContasReceber() {
  const [q, setQ] = useState("");
  const atendimentos = useTable<any>("atendimentos", "data");
  const parcelas = useTable<any>("parcelas", "vencimento", true);
  const updParcela = useUpdate("parcelas");
  const updAtend = useUpdate("atendimentos");

  const loading = atendimentos.isLoading || parcelas.isLoading;

  const contas = useMemo(
    () => contasAReceber(atendimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, parcelas.data],
  );

  const aberto = useMemo(
    () => valoresEmAberto(atendimentos.data ?? [], parcelas.data ?? []),
    [atendimentos.data, parcelas.data],
  );

  const rows = useMemo(() => {
    if (!q) return contas;
    const s = q.toLowerCase();
    return contas.filter(
      (c) => c.paciente.toLowerCase().includes(s) || c.procedimento.toLowerCase().includes(s),
    );
  }, [contas, q]);

  const totalReceber = aberto.reduce((s, p) => s + p.valor_liquido, 0);
  const parcelasRestantes = aberto.length;
  const pacientes = new Set(contas.map((c) => c.paciente)).size;

  const pagarParcela = (pid: string) =>
    updParcela.mutate(
      { id: pid, values: { status: "pago", data_pagamento: todayISO() } },
      { onSuccess: () => toast.success("Parcela recebida") },
    );

  const pagarAtendimento = (aid: string) =>
    updAtend.mutate(
      { id: aid, values: { status_pagamento: "pago" } },
      { onSuccess: () => toast.success("Pagamento registrado") },
    );

  return (
    <>
      <PageHeader
        title="Contas a Receber"
        description="Parcelas e atendimentos pendentes — só entram no caixa quando recebidos"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label="Total a receber" value={brl(totalReceber)} tone={totalReceber > 0 ? "warning" : "success"} icon={<HandCoins className="h-4 w-4" />} hint="Líquido em aberto" />
        <StatCard label="Parcelas em aberto" value={String(parcelasRestantes)} tone="primary" icon={<CalendarClock className="h-4 w-4" />} />
        <StatCard label="Contratos abertos" value={String(rows.length)} icon={<Layers className="h-4 w-4" />} hint="Atendimentos com saldo" />
        <StatCard label="Pacientes" value={String(pacientes)} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar paciente ou procedimento..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-card py-16 text-center text-muted-foreground" style={{ boxShadow: "var(--shadow-soft)" }}>
          <CheckCircle2 className="h-8 w-8 mx-auto mb-3 text-success" />
          Nenhuma conta a receber em aberto.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const pct = c.total > 0 ? (c.pagas / c.total) * 100 : 0;
            const proxParcela = c.parcelas.find((p) => p.status !== "pago");
            return (
              <div key={c.atendimento_id} className="rounded-2xl border bg-card p-4 sm:p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{c.paciente || "—"}</h3>
                      {c.total > 1 && (
                        <Badge variant="outline" className="gap-1">
                          <CalendarClock className="h-3 w-3" /> Parcelado
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{c.procedimento} · {c.forma_pagamento}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-warning">{brl(c.valorRestante)}</div>
                    <div className="text-xs text-muted-foreground">de {brl(c.valorTotal)}</div>
                  </div>
                </div>

                {c.total > 1 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{c.pagas}/{c.total} parcelas pagas</span>
                      {c.proximoVencimento && <span>Próx. venc. {formatDateBR(c.proximoVencimento)}</span>}
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {c.total > 1 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {c.parcelas.map((p) => (
                        <span
                          key={p.id}
                          title={`Parcela ${p.numero} · ${brl(p.valor_liquido)} · vence ${formatDateBR(p.vencimento)}`}
                          className={
                            "inline-flex h-6 min-w-6 items-center justify-center rounded-md px-1.5 text-[11px] font-medium " +
                            (p.status === "pago"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning")
                          }
                        >
                          {p.numero}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Venc. {formatDateBR(c.proximoVencimento)}
                    </span>
                  )}

                  {c.total > 1 && proxParcela ? (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                      disabled={updParcela.isPending}
                      onClick={() => pagarParcela(proxParcela.id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Receber parcela {proxParcela.numero}
                    </Button>
                  ) : c.total === 1 ? (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
                      disabled={updAtend.isPending}
                      onClick={() => pagarAtendimento(c.atendimento_id)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar como pago
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
