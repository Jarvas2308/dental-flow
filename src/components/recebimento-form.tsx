import { useMemo, useState } from "react";
import { useCreate, useDelete, useTable } from "@/hooks/use-data";
import { brl, formatDateBR, todayISO } from "@/lib/format";
import { resumoAtendimento, STATUS_LABEL } from "@/lib/finance";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RegistrarRecebimento({
  atendimento,
  trigger,
}: {
  atendimento: any;
  trigger?: React.ReactNode;
}) {
  const formas = useTable<any>("formas_pagamento", "nome", true);
  const recebimentos = useTable<any>("recebimentos", "data", true);
  const create = useCreate("recebimentos");
  const del = useDelete("recebimentos");
  const [open, setOpen] = useState(false);

  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());
  const [forma, setForma] = useState(atendimento.forma_pagamento ?? "");
  const [obs, setObs] = useState("");

  const recsDoAtend = useMemo(
    () => (recebimentos.data ?? []).filter((r) => r.atendimento_id === atendimento.id),
    [recebimentos.data, atendimento.id],
  );

  const resumo = useMemo(
    () => resumoAtendimento(atendimento, recsDoAtend),
    [atendimento, recsDoAtend],
  );

  const pct = resumo.total > 0 ? Math.min(100, (resumo.recebido / resumo.total) * 100) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Number(valor);
    if (!v || v <= 0) return toast.error("Informe um valor válido");
    if (v > resumo.saldo + 0.005) {
      return toast.error(`Valor acima do saldo pendente (${brl(resumo.saldo)})`);
    }
    await create.mutateAsync({
      atendimento_id: atendimento.id,
      valor: v,
      data,
      forma_pagamento: forma || atendimento.forma_pagamento || null,
      observacao: obs.trim() || null,
    });
    toast.success("Recebimento registrado");
    setValor(""); setObs(""); setData(todayISO());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10">
            <HandCoins className="h-4 w-4" /> Receber
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar recebimento</DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium truncate">{atendimento.paciente || "—"}</span>
            <Badge variant="outline" className="capitalize">{STATUS_LABEL[resumo.status]}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-semibold">{brl(resumo.total)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Recebido</div>
              <div className="font-semibold text-success">{brl(resumo.recebido)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Saldo</div>
              <div className="font-semibold text-warning">{brl(resumo.saldo)}</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recebimentos: {resumo.qtd}/{resumo.parcelasCombinadas}</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {resumo.saldo > 0.005 ? (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor recebido (R$)</Label>
                <Input type="number" step="0.01" autoFocus value={valor}
                  onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={forma} onValueChange={setForma}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(formas.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: entrada, sinal..." />
            </div>
            <Button type="submit" className="w-full gap-1.5" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Registrar recebimento
            </Button>
          </form>
        ) : (
          <div className="rounded-xl bg-success/10 text-success text-sm text-center py-3 font-medium">
            Tratamento quitado ✓
          </div>
        )}

        {recsDoAtend.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Recebimentos registrados</Label>
            <div className="max-h-40 overflow-auto space-y-1.5">
              {[...recsDoAtend]
                .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">{brl(r.valor)}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {formatDateBR(r.data)}{r.forma_pagamento ? ` · ${r.forma_pagamento}` : ""}
                        {r.observacao ? ` · ${r.observacao}` : ""}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => del.mutate(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
