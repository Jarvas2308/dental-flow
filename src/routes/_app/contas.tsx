import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useDelete, useUpdate } from "@/hooks/use-data";
import { useGerarRecorrentes } from "@/hooks/use-recurring";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Search, Loader2, Check, RotateCw } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contas")({
  component: Contas,
});

type Despesa = {
  id?: string;
  nome: string;
  valor: number | string | null;
  vencimento: string;
  data_pagamento?: string | null;
  status: "pago" | "pendente" | "atrasado";
  recorrente: boolean;
  tipo_recorrencia: "fixo" | "variavel";
  observacoes?: string | null;
  origem_id?: string | null;
};

const empty = (): Despesa => ({
  nome: "", valor: "", vencimento: new Date().toISOString().slice(0, 10),
  status: "pendente", recorrente: false, tipo_recorrencia: "fixo", observacoes: "",
});

function statusBadge(s: string) {
  if (s === "pago") return <Badge className="bg-success text-success-foreground hover:bg-success/90">Pago</Badge>;
  if (s === "atrasado") return <Badge variant="destructive">Atrasado</Badge>;
  if (s === "aguardando") return <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Aguardando valor</Badge>;
  return <Badge variant="outline">Pendente</Badge>;
}

function computeStatus(d: any): "pago" | "pendente" | "atrasado" | "aguardando" {
  if (d.status === "pago") return "pago";
  if (d.recorrente && d.tipo_recorrencia === "variavel" && (d.valor === null || Number(d.valor) === 0)) {
    return "aguardando";
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const v = new Date(d.vencimento + "T00:00:00");
  return v < today ? "atrasado" : "pendente";
}

function DespesaForm({
  editing, onClose,
}: {
  editing?: any;
  onClose?: () => void;
}) {
  const create = useCreate("despesas");
  const update = useUpdate("despesas");
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Despesa>(editing ? { ...editing } : empty());

  useEffect(() => { if (open) setV(editing ? { ...editing } : empty()); }, [open, editing]);

  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.nome.trim()) return toast.error("Informe o nome");
    const variavelSemValor = v.recorrente && v.tipo_recorrencia === "variavel" && !Number(v.valor);
    if (!variavelSemValor && !Number(v.valor)) return toast.error("Informe o valor");
    const payload: any = {
      nome: v.nome.trim(),
      valor: variavelSemValor ? null : Number(v.valor),
      vencimento: v.vencimento,
      status: v.status,
      recorrente: v.recorrente,
      tipo_recorrencia: v.recorrente ? v.tipo_recorrencia : "fixo",
      data_pagamento: v.status === "pago" ? (v.data_pagamento || v.vencimento) : null,
      observacoes: v.observacoes?.toString().trim() || null,
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
          <Button><Plus className="h-4 w-4" /> Nova despesa</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar despesa" : "Nova despesa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input required value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Valor (R$)
                {v.recorrente && v.tipo_recorrencia === "variavel" && (
                  <span className="ml-1 text-xs text-muted-foreground">(opcional)</span>
                )}
              </Label>
              <Input type="number" step="0.01" value={v.valor ?? ""}
                onChange={(e) => setV({ ...v, valor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento</Label>
              <Input type="date" required value={v.vencimento}
                onChange={(e) => setV({ ...v, vencimento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={v.status} onValueChange={(s: any) => setV({ ...v, status: s })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="atrasado">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {v.status === "pago" && (
              <div className="space-y-1.5">
                <Label>Pago em</Label>
                <Input type="date" value={v.data_pagamento ?? v.vencimento}
                  onChange={(e) => setV({ ...v, data_pagamento: e.target.value })} />
              </div>
            )}
          </div>
          <div className="space-y-3 p-3 rounded-lg bg-muted/40">
            <div className="flex items-center justify-between">
              <div>
                <Label className="cursor-pointer">Despesa recorrente</Label>
                <p className="text-xs text-muted-foreground">Repete automaticamente todo mês</p>
              </div>
              <Switch checked={v.recorrente} onCheckedChange={(c) => setV({ ...v, recorrente: c })} />
            </div>
            {v.recorrente && (
              <div className="space-y-1.5">
                <Label>Tipo de recorrência</Label>
                <Select value={v.tipo_recorrencia}
                  onValueChange={(s: any) => setV({ ...v, tipo_recorrencia: s })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixo">Valor fixo (aluguel, internet…)</SelectItem>
                    <SelectItem value="variavel">Valor variável (água, energia…)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {v.tipo_recorrencia === "variavel"
                    ? "Próximos meses serão criados sem valor, aguardando preenchimento."
                    : "Próximos meses serão criados com o mesmo valor."}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={v.observacoes ?? ""} onChange={(e) => setV({ ...v, observacoes: e.target.value })} />
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

function EditDespesa({ row }: { row: any }) {
  const [editing, setEditing] = useState<any | null>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(row)}>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      {editing && <DespesaForm editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Contas() {
  const { gerar, loading: gerando } = useGerarRecorrentes();
  const [mes, setMes] = useState(currentMonthKey());
  const [aba, setAba] = useState<"todas" | "pendente" | "aguardando" | "atrasado" | "pago">("todas");
  const [q, setQ] = useState("");
  const list = useTable<any>("despesas", "vencimento", true);
  const upd = useUpdate("despesas");
  const del = useDelete("despesas");

  // Aplica status calculado (atrasado) e ordena por vencimento ASC
  const enriched = useMemo(() => {
    return (list.data ?? []).map((r) => ({ ...r, status: computeStatus(r) }));
  }, [list.data]);

  const rowsMes = useMemo(() => enriched
    .filter((r) => monthKey(r.vencimento) === mes)
    .filter((r) => aba === "todas" ? true : r.status === aba)
    .filter((r) => !q || r.nome.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento)),
    [enriched, mes, aba, q]);

  const totMes = enriched.filter((r) => monthKey(r.vencimento) === mes);
  const totalPago = totMes.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalPendente = totMes.filter((r) => r.status === "pendente").reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalAtrasado = totMes.filter((r) => r.status === "atrasado").reduce((s, r) => s + Number(r.valor || 0), 0);
  const totalAguardando = totMes.filter((r) => r.status === "aguardando").length;
  const totalGeral = totalPago + totalPendente + totalAtrasado;

  const marcarPago = (r: any) => {
    upd.mutate({
      id: r.id,
      values: { status: "pago", data_pagamento: new Date().toISOString().slice(0, 10) },
    });
  };

  return (
    <>
      <PageHeader title="Despesas" description="Controle de contas e gastos do consultório"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => gerar(mes)} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Gerar recorrentes
            </Button>
            <DespesaForm />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard label={`Total · ${monthLabel(mes)}`} value={brl(totalGeral)} tone="primary" />
        <StatCard label="Pago" value={brl(totalPago)} tone="success" />
        <StatCard label="Pendente" value={brl(totalPendente)} tone="warning" />
        <StatCard label="Atrasado" value={brl(totalAtrasado)} tone="destructive" />
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions(12).map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar despesa..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={aba} onValueChange={(v) => setAba(v as any)}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({totMes.length})</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="aguardando">
            Aguardando{totalAguardando > 0 ? ` (${totalAguardando})` : ""}
          </TabsTrigger>
          <TabsTrigger value="atrasado">Atrasadas</TabsTrigger>
          <TabsTrigger value="pago">Pagas</TabsTrigger>
        </TabsList>
        <TabsContent value={aba} className="mt-4">
          <div className="rounded-2xl border bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Despesa</TableHead>
                  <TableHead>Status</TableHead>
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
                {!list.isLoading && rowsMes.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-12">Nenhuma despesa.</TableCell></TableRow>
                )}
                {rowsMes.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(r.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {r.nome}
                        {r.recorrente && <RotateCw className="h-3 w-3 text-muted-foreground" aria-label="Recorrente" />}
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {r.valor == null ? <span className="text-muted-foreground">—</span> : brl(r.valor)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status !== "pago" && r.status !== "aguardando" && (
                          <Button variant="ghost" size="icon" aria-label="Marcar como pago"
                            onClick={() => marcarPago(r)}>
                            <Check className="h-4 w-4 text-success" />
                          </Button>
                        )}
                        <EditDespesa row={r} />
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
              <span className="text-sm text-muted-foreground">{rowsMes.length} despesa(s)</span>
              <span className="font-semibold">
                Total: {brl(rowsMes.reduce((s, r) => s + Number(r.valor || 0), 0))}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
