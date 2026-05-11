import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useDelete } from "@/hooks/use-data";
import { brl, currentMonthKey, monthKey, monthLabel, monthOptions } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CustoLabForm, EditCustoButton } from "@/components/custo-lab-form";

export const Route = createFileRoute("/_app/laboratorio")({
  component: Laboratorio,
});

function Laboratorio() {
  const [mes, setMes] = useState(currentMonthKey());
  const [q, setQ] = useState("");
  const list = useTable<any>("custos_laboratorio", "data");
  const del = useDelete("custos_laboratorio");

  const rows = useMemo(
    () => (list.data ?? [])
      .filter((r) => monthKey(r.data) === mes)
      .filter((r) => !q ||
        r.paciente?.toLowerCase().includes(q.toLowerCase()) ||
        r.laboratorio?.toLowerCase().includes(q.toLowerCase())),
    [list.data, mes, q],
  );

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <>
      <PageHeader title="Laboratório" description="Custos laboratoriais por paciente e procedimento"
        actions={<CustoLabForm />}
      />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <StatCard label={`Total · ${monthLabel(mes)}`} value={brl(total)} tone="primary" />
        <StatCard label="Trabalhos" value={String(rows.length)} hint="No mês selecionado" />
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
          <Input placeholder="Buscar paciente ou laboratório..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Laboratório</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Procedimento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Nenhum custo neste mês.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{r.laboratorio}</TableCell>
                <TableCell>{r.tipo_trabalho}</TableCell>
                <TableCell>{r.paciente}</TableCell>
                <TableCell className="text-muted-foreground">{r.procedimento || "—"}</TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <EditCustoButton row={r} />
                    <ConfirmDelete
                      title="Excluir custo?"
                      description={`Custo de ${r.laboratorio} será removido permanentemente.`}
                      onConfirm={() => del.mutate(r.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30">
          <span className="text-sm text-muted-foreground">{rows.length} item(s)</span>
          <span className="font-semibold">Total: {brl(total)}</span>
        </div>
      </div>
    </>
  );
}
