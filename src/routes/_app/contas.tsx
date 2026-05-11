import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { brl, currentMonthKey, monthKey, monthLabel, monthOptions } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Search, Loader2 } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contas")({
  component: Contas,
});

type Tbl = "gastos_fixos" | "gastos_variaveis";

type Gasto = {
  id?: string;
  nome: string;
  valor: number | string;
  data: string;
  categoria: string;
  observacoes: string;
};

const empty = (): Gasto => ({
  nome: "", valor: "", data: new Date().toISOString().slice(0, 10),
  categoria: "", observacoes: "",
});

function GastoForm({
  table, editing, onClose,
}: {
  table: Tbl;
  editing?: any;
  onClose?: () => void;
}) {
  const create = useCreate(table);
  const update = useUpdate(table);
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Gasto>(editing ? { ...editing } : empty());

  useEffect(() => { if (open) setV(editing ? { ...editing } : empty()); }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.nome.trim()) return toast.error("Informe o nome");
    if (!Number(v.valor)) return toast.error("Informe o valor");
    const payload = {
      nome: v.nome.trim(),
      valor: Number(v.valor),
      data: v.data,
      categoria: v.categoria?.trim() || null,
      observacoes: v.observacoes?.trim() || null,
    };
    if (isEdit) await update.mutateAsync({ id: editing.id, values: payload });
    else await create.mutateAsync(payload);
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) onClose?.(); }}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button><Plus className="h-4 w-4" /> Novo</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar despesa" : table === "gastos_fixos" ? "Novo gasto fixo" : "Novo gasto variável"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da despesa</Label>
            <Input required value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" required value={v.valor}
                onChange={(e) => setV({ ...v, valor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" required value={v.data} onChange={(e) => setV({ ...v, data: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Input value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={v.observacoes} onChange={(e) => setV({ ...v, observacoes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditGasto({ table, row }: { table: Tbl; row: any }) {
  const [editing, setEditing] = useState<any | null>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(row)}>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      {editing && <GastoForm table={table} editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function GastosSection({ table }: { table: Tbl }) {
  const [mes, setMes] = useState(currentMonthKey());
  const [cat, setCat] = useState("__all");
  const [q, setQ] = useState("");
  const list = useTable<any>(table, "data");
  const del = useDelete(table);

  const cats = useMemo(
    () => Array.from(new Set((list.data ?? []).map((r) => r.categoria).filter(Boolean))),
    [list.data],
  );

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
        <GastoForm table={table} />
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-12">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Sem lançamentos neste mês.</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.categoria || "—"}</TableCell>
                <TableCell className="text-right font-medium">{brl(r.valor)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <EditGasto table={table} row={r} />
                    <ConfirmDelete
                      title="Excluir despesa?"
                      description={`"${r.nome}" será removida permanentemente.`}
                      onConfirm={() => del.mutate(r.id)}
                    />
                  </div>
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
  const [mes] = useState(currentMonthKey());
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
    </>
  );
}
