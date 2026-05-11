import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useUpdate } from "@/hooks/use-data";
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
import { Search, FileCheck2, Loader2 } from "lucide-react";
import { useDelete } from "@/hooks/use-data";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AtendimentoForm, EditAtendimentoButton } from "@/components/atendimento-form";

export const Route = createFileRoute("/_app/consultorio")({
  component: Consultorio,
});

function Consultorio() {
  const [mes, setMes] = useState(currentMonthKey());
  const [q, setQ] = useState("");
  const list = useTable<any>("atendimentos", "data");
  const upd = useUpdate("atendimentos");
  const del = useDelete("atendimentos");

  const rows = useMemo(
    () => (list.data ?? [])
      .filter((r) => monthKey(r.data) === mes)
      .filter((r) => !q || r.paciente.toLowerCase().includes(q.toLowerCase())),
    [list.data, mes, q],
  );

  const totBruto = rows.reduce((s, r) => s + Number(r.valor_bruto || 0), 0);
  const totLiq = rows.reduce((s, r) => s + Number(r.valor_liquido || 0), 0);
  const totNF = rows.filter((r) => r.nota_fiscal).length;

  return (
    <>
      <PageHeader title="Consultório" description="Atendimentos e procedimentos realizados"
        actions={<AtendimentoForm />}
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label={`Bruto · ${monthLabel(mes)}`} value={brl(totBruto)} tone="primary" />
        <StatCard label="Líquido" value={brl(totLiq)} tone="success" hint="Após taxas" />
        <StatCard label="NFs emitidas" value={`${totNF} de ${rows.length}`} icon={<FileCheck2 className="h-4 w-4" />} />
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions(12).map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

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
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">Nenhum atendimento neste mês.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
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
