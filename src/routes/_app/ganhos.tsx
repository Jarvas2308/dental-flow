import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTable, useCreate, useUpdate, useDelete } from "@/hooks/use-data";
import {
  brl,
  currentMonthKey,
  formatDateBR,
  monthKey,
  monthLabel,
  monthOptions,
  todayISO,
} from "@/lib/format";
import { PageHeader, StatCard } from "@/components/ui-kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Loader2, PiggyBank } from "lucide-react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ReceitaRow = Database["public"]["Tables"]["receitas_extras"]["Row"];

export const Route = createFileRoute("/_app/ganhos")({
  component: Ganhos,
});

const TIPOS = [
  { v: "aluguel", l: "Aluguel" },
  { v: "rendimento", l: "Rendimento" },
  { v: "venda", l: "Venda" },
  { v: "servico_extra", l: "Serviço extra" },
  { v: "outros", l: "Outros" },
];

const tipoLabel = (v: string) => TIPOS.find((t) => t.v === v)?.l ?? v;

type Receita = {
  id?: string;
  descricao: string;
  valor: number | string;
  data: string;
  tipo: string;
  observacoes?: string | null;
};

const empty = (): Receita => ({
  descricao: "",
  valor: "",
  data: todayISO(),
  tipo: "outros",
  observacoes: "",
});

function ReceitaForm({ editing, onClose }: { editing?: ReceitaRow; onClose?: () => void }) {
  const create = useCreate("receitas_extras");
  const update = useUpdate("receitas_extras");
  const [open, setOpen] = useState(!!editing);
  const [v, setV] = useState<Receita>(editing ? { ...editing } : empty());

  useEffect(() => {
    if (open) setV(editing ? { ...editing } : empty());
  }, [open, editing]);
  const isEdit = !!editing;
  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.descricao.trim()) return toast.error("Informe a descrição");
    if (!Number(v.valor)) return toast.error("Informe o valor");
    const payload = {
      descricao: v.descricao.trim(),
      valor: Number(v.valor),
      data: v.data,
      tipo: v.tipo,
      observacoes: v.observacoes?.toString().trim() || null,
    };
    if (isEdit) await update.mutateAsync({ id: editing.id, values: payload });
    else await create.mutateAsync(payload);
    setOpen(false);
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) onClose?.();
      }}
    >
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4" /> Novo ganho
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar ganho" : "Novo ganho extra"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Input
              required
              value={v.descricao}
              onChange={(e) => setV({ ...v, descricao: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={v.valor}
                onChange={(e) => setV({ ...v, valor: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                required
                value={v.data}
                onChange={(e) => setV({ ...v, data: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Tipo</Label>
              <Select value={v.tipo} onValueChange={(s) => setV({ ...v, tipo: s })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              value={v.observacoes ?? ""}
              onChange={(e) => setV({ ...v, observacoes: e.target.value })}
            />
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

function EditReceita({ row }: { row: ReceitaRow }) {
  const [editing, setEditing] = useState<ReceitaRow | null>(null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(row)}>
        <Pencil className="h-4 w-4 text-muted-foreground" />
      </Button>
      {editing && <ReceitaForm editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Ganhos() {
  const [mes, setMes] = useState(currentMonthKey());
  const list = useTable<ReceitaRow>("receitas_extras", "data", false);
  const del = useDelete("receitas_extras");

  const rows = useMemo(
    () =>
      (list.data ?? [])
        .filter((r) => monthKey(r.data) === mes)
        .sort((a, b) => b.data.localeCompare(a.data)),
    [list.data, mes],
  );

  const total = rows.reduce((s, r) => s + Number(r.valor || 0), 0);
  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.tipo, (map.get(r.tipo) ?? 0) + Number(r.valor || 0)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Ganhos Extras"
        description="Receitas administrativas separadas dos atendimentos"
        actions={<ReceitaForm />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
        <StatCard
          label={`Total · ${monthLabel(mes)}`}
          value={brl(total)}
          tone="success"
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <StatCard label="Lançamentos" value={String(rows.length)} tone="primary" />
        <StatCard
          label="Maior categoria"
          value={porTipo[0] ? tipoLabel(porTipo[0][0]) : "—"}
          hint={porTipo[0] ? brl(porTipo[0][1]) : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions(12).map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!list.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                  Nenhum ganho registrado neste mês.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{formatDateBR(r.data)}</TableCell>
                <TableCell className="font-medium">{r.descricao}</TableCell>
                <TableCell>
                  <Badge variant="outline">{tipoLabel(r.tipo)}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-success">
                  {brl(r.valor)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <EditReceita row={r} />
                    <ConfirmDelete
                      title="Excluir ganho?"
                      description={`"${r.descricao}" será removido permanentemente.`}
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
    </>
  );
}
