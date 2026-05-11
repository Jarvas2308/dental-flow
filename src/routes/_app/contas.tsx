import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTable, useCreate, useDelete } from "@/hooks/use-data";
import { brl, currentMonthKey, monthKey, monthLabel, monthOptions } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import { FormDialog, type FieldDef } from "@/components/form-dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_app/contas")({
  component: Contas,
});

const fields: FieldDef[] = [
  { name: "nome", label: "Nome da despesa", type: "text", required: true },
  { name: "valor", label: "Valor (R$)", type: "number", step: "0.01", required: true },
  { name: "data", label: "Data", type: "date", required: true },
  { name: "categoria", label: "Categoria", type: "text" },
  { name: "observacoes", label: "Observações", type: "textarea" },
];

function GastosSection({ table }: { table: "gastos_fixos" | "gastos_variaveis" }) {
  const [mes, setMes] = useState(currentMonthKey());
  const [cat, setCat] = useState("__all");
  const [q, setQ] = useState("");
  const list = useTable<any>(table, "data");
  const create = useCreate(table);
  const del = useDelete(table);

  const cats = useMemo(() => Array.from(new Set((list.data ?? []).map((r) => r.categoria).filter(Boolean))), [list.data]);

  const rows = (list.data ?? [])
    .filter((r) => monthKey(r.data) === mes)
    .filter((r) => cat === "__all" || r.categoria === cat)
    .filter((r) => !q || r.nome.toLowerCase().includes(q.toLowerCase()));

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions(12).map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Todas categorias</SelectItem>
            {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <FormDialog
          title={table === "gastos_fixos" ? "Novo gasto fixo" : "Novo gasto variável"}
          fields={fields}
          defaults={{ data: new Date().toISOString().slice(0, 10) }}
          busy={create.isPending}
          onSubmit={async (v) => create.mutateAsync({ ...v, valor: Number(v.valor) })}
        />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Sem lançamentos neste mês.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.categoria || "—"}</TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-between items-center px-4 py-3 border-t bg-muted/30">
          <span className="text-sm text-muted-foreground">{rows.length} lançamento(s)</span>
          <span className="font-semibold">Total: {brl(total)}</span>
        </div>
      </div>
    </div>
  );
}

function Contas() {
  const [mes, setMes] = useState(currentMonthKey());
  const fixos = useTable<any>("gastos_fixos");
  const variaveis = useTable<any>("gastos_variaveis");

  const tF = (fixos.data ?? []).filter((r) => monthKey(r.data) === mes).reduce((s, r) => s + Number(r.valor), 0);
  const tV = (variaveis.data ?? []).filter((r) => monthKey(r.data) === mes).reduce((s, r) => s + Number(r.valor), 0);

  return (
    <>
      <PageHeader title="Contas" description="Controle de despesas do consultório" />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label={`Fixos · ${monthLabel(mes)}`} value={brl(tF)} tone="warning" />
        <StatCard label={`Variáveis · ${monthLabel(mes)}`} value={brl(tV)} tone="warning" />
        <StatCard label="Total Geral" value={brl(tF + tV)} tone="primary" />
      </div>

      <Tabs defaultValue="fixos">
        <TabsList>
          <TabsTrigger value="fixos">Gastos fixos</TabsTrigger>
          <TabsTrigger value="variaveis">Gastos variáveis</TabsTrigger>
        </TabsList>
        <TabsContent value="fixos" className="mt-4"><GastosSection table="gastos_fixos" /></TabsContent>
        <TabsContent value="variaveis" className="mt-4"><GastosSection table="gastos_variaveis" /></TabsContent>
      </Tabs>

      {/* hidden util to silence unused setMes in mock */}
      <span className="hidden">{mes}</span>
      <button className="hidden" onClick={() => setMes(currentMonthKey())} />
    </>
  );
}
