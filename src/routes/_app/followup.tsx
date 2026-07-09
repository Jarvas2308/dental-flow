import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useTable, useCreate, useUpdate } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { resolvePacienteId } from "@/lib/pacientes";
import { brl, formatDateBR, todayISO } from "@/lib/format";
import { proximaTentativa, estaPendenteHoje } from "@/lib/followup";
import {
  PacienteCombobox,
  AtendimentoForm,
  ProcedimentoCombobox,
} from "@/components/atendimento-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  Plus,
  Loader2,
  MessageCircle,
  CheckCircle2,
  XCircle,
  CalendarClock,
  Pencil,
  CircleDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";

export const Route = createFileRoute("/_app/followup")({
  component: Followup,
});

type Proposta = {
  paciente: string;
  tratamento: string;
  valor_estimado: number | string;
  data_proposta: string;
  fase1_intervalo_dias: number | string;
  fase1_qtd: number | string;
  fase2_intervalo_dias: number | string;
  fase2_qtd: number | string;
  fase3_intervalo_dias: number | string;
};

const empty = (): Proposta => ({
  paciente: "",
  tratamento: "",
  valor_estimado: "",
  data_proposta: todayISO(),
  fase1_intervalo_dias: 3,
  fase1_qtd: 1,
  fase2_intervalo_dias: 7,
  fase2_qtd: 1,
  fase3_intervalo_dias: 15,
});

function PropostaForm({ proposta, onClose }: { proposta?: any; onClose: () => void }) {
  const create = useCreate("tratamentos_propostos");
  const update = useUpdate("tratamentos_propostos");
  const procedimentos = useTable<any>("procedimentos", "nome", true);
  const pacientes = useTable<any>("pacientes", "nome", true);
  const { user } = useAuth();
  const qc = useQueryClient();
  // Guarda o id vindo do combobox quando um paciente existente é selecionado.
  const [pacienteId, setPacienteId] = useState<string | null>(proposta?.paciente_id ?? null);
  const [v, setV] = useState<Proposta>(
    proposta
      ? {
          paciente: String(proposta.paciente ?? ""),
          tratamento: String(proposta.tratamento ?? ""),
          valor_estimado: proposta.valor_estimado == null ? "" : String(proposta.valor_estimado),
          data_proposta: String(proposta.data_proposta ?? todayISO()),
          fase1_intervalo_dias: String(proposta.fase1_intervalo_dias ?? ""),
          fase1_qtd: String(proposta.fase1_qtd ?? ""),
          fase2_intervalo_dias: String(proposta.fase2_intervalo_dias ?? ""),
          fase2_qtd: String(proposta.fase2_qtd ?? ""),
          fase3_intervalo_dias: String(proposta.fase3_intervalo_dias ?? ""),
        }
      : empty(),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v.paciente.trim()) return toast.error("Informe o paciente");
    if (!v.tratamento.trim()) return toast.error("Informe o tratamento");
    if (!v.data_proposta) return toast.error("Informe a data da proposta");

    // Resolve/crie o paciente_id preservando o texto do nome para compatibilidade.
    let idResolvido: string | null = pacienteId;
    try {
      idResolvido = await resolvePacienteId({
        nome: v.paciente,
        userId: user!.id,
        knownId: pacienteId,
        cache: pacientes.data ?? [],
      });
    } catch (err) {
      console.error("[PropostaForm] Erro ao resolver paciente:", err);
      toast.error("Não foi possível vincular o paciente. Tente novamente.");
      return;
    }

    const payload = {
      paciente: v.paciente.trim(),
      paciente_id: idResolvido,
      tratamento: v.tratamento.trim(),
      valor_estimado: v.valor_estimado === "" ? null : Number(v.valor_estimado),
      data_proposta: v.data_proposta,
      fase1_intervalo_dias: Number(v.fase1_intervalo_dias) || 0,
      fase1_qtd: Number(v.fase1_qtd) || 0,
      fase2_intervalo_dias: Number(v.fase2_intervalo_dias) || 0,
      fase2_qtd: Number(v.fase2_qtd) || 0,
      fase3_intervalo_dias: Number(v.fase3_intervalo_dias) || 0,
    };

    if (proposta) {
      await update.mutateAsync({ id: proposta.id, values: payload });
    } else {
      await create.mutateAsync({ ...payload, tentativas_feitas: 0, status: "acompanhando" });
    }
    qc.invalidateQueries({ queryKey: ["pacientes"] });
    onClose();
  };

  const isPending = proposta ? update.isPending : create.isPending;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Paciente</Label>
        <PacienteCombobox
          value={v.paciente}
          onChange={(nome, id) => {
            setV((p) => ({ ...p, paciente: nome }));
            setPacienteId(id);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Tratamento</Label>
        <ProcedimentoCombobox
          value={v.tratamento}
          onChange={(nome) => setV((p) => ({ ...p, tratamento: nome }))}
          options={procedimentos.data ?? []}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor estimado (R$)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="opcional"
            value={v.valor_estimado}
            onChange={(e) => setV({ ...v, valor_estimado: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Data da proposta</Label>
          <Input
            type="date"
            required
            value={v.data_proposta}
            onChange={(e) => setV({ ...v, data_proposta: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border p-3">
        <div className="space-y-2">
          <p className="text-sm font-medium">Fase 1 — Curto prazo</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">A cada (dias)</Label>
              <Input
                type="number"
                min="1"
                value={v.fase1_intervalo_dias}
                onChange={(e) => setV({ ...v, fase1_intervalo_dias: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tentativas</Label>
              <Input
                type="number"
                min="0"
                value={v.fase1_qtd}
                onChange={(e) => setV({ ...v, fase1_qtd: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Fase 2 — Médio prazo</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">A cada (dias)</Label>
              <Input
                type="number"
                min="1"
                value={v.fase2_intervalo_dias}
                onChange={(e) => setV({ ...v, fase2_intervalo_dias: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tentativas</Label>
              <Input
                type="number"
                min="0"
                value={v.fase2_qtd}
                onChange={(e) => setV({ ...v, fase2_qtd: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Fase 3 — Longo prazo</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">A cada (dias)</Label>
              <Input
                type="number"
                min="1"
                value={v.fase3_intervalo_dias}
                onChange={(e) => setV({ ...v, fase3_intervalo_dias: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Repete até você marcar como Fechado ou Recusado
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

function NovaProposta() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Nova proposta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova proposta</DialogTitle>
        </DialogHeader>
        {open && <PropostaForm proposta={undefined} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function EditarPropostaButton({ proposta }: { proposta: any }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1">
          <Pencil className="h-4 w-4" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar proposta</DialogTitle>
        </DialogHeader>
        {open && <PropostaForm proposta={proposta} onClose={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ContatadoButton({ proposta }: { proposta: any }) {
  const create = useCreate("tentativas_contato");
  const update = useUpdate("tratamentos_propostos");
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState("");

  const confirmar = async () => {
    // Ignora cliques repetidos enquanto o registro está sendo salvo.
    if (create.isPending || update.isPending) return;
    await create.mutateAsync({
      tratamento_proposto_id: proposta.id,
      data: todayISO(),
      observacao: obs.trim() || null,
    });
    update.mutate({
      id: proposta.id,
      values: { tentativas_feitas: Number(proposta.tentativas_feitas) + 1 },
    });
    setObs("");
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setObs("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary hover:bg-primary/10">
          <MessageCircle className="h-4 w-4" /> Contatado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Observação (opcional)</Label>
          <Textarea
            rows={3}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: ligou, sem resposta..."
          />
        </div>
        <DialogFooter>
          <Button onClick={confirmar} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FecharButton({ proposta }: { proposta: any }) {
  const update = useUpdate("tratamentos_propostos");
  // Garante que a proposta seja fechada uma única vez, mesmo com cliques
  // repetidos. Em caso de falha, libera para nova tentativa.
  const done = useRef(false);
  return (
    <AtendimentoForm
      initialData={{
        paciente: proposta.paciente,
        valorEstimado: Number(proposta.valor_estimado) || undefined,
      }}
      onSaved={async () => {
        if (done.current) return;
        done.current = true;
        try {
          await update.mutateAsync({ id: proposta.id, values: { status: "fechado" } });
        } catch (e) {
          done.current = false;
          throw e;
        }
      }}
      trigger={
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-success hover:bg-success/10">
          <CheckCircle2 className="h-4 w-4" /> Fechado
        </Button>
      }
    />
  );
}

function Followup() {
  const props = useTable<any>("tratamentos_propostos", "data_proposta", true);
  const tentativas = useTable<any>("tentativas_contato", "data", true);
  const update = useUpdate("tratamentos_propostos");

  const allTentativas = useMemo(() => tentativas.data ?? [], [tentativas.data]);

  const rows = useMemo(() => {
    return (props.data ?? [])
      .filter((p) => p.status === "acompanhando")
      .map((p) => {
        const ts = allTentativas.filter((t) => t.tratamento_proposto_id === p.id);
        const prox = proximaTentativa(p, ts);
        return { p, prox, pendente: estaPendenteHoje(prox.dataPrevista) };
      })
      .sort((a, b) => a.prox.dataPrevista.localeCompare(b.prox.dataPrevista));
  }, [props.data, allTentativas]);

  const pendentes = rows.filter((r) => r.pendente).length;
  const valorTotal = rows.reduce((s, r) => s + (Number(r.p.valor_estimado) || 0), 0);

  const pag = usePagination(rows, 20);

  const marcarStatus = (id: string, status: string) => update.mutate({ id, values: { status } });

  return (
    <>
      <PageHeader
        title="Follow-up"
        description="Acompanhamento de tratamentos propostos"
        actions={<NovaProposta />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
        <StatCard
          label="Em acompanhamento"
          value={String(rows.length)}
          tone="primary"
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <StatCard
          label="Pendentes hoje"
          value={String(pendentes)}
          tone={pendentes > 0 ? "destructive" : undefined}
        />
        <StatCard
          label="Valor em acompanhamento"
          value={brl(valorTotal)}
          tone="success"
          icon={<CircleDollarSign className="h-4 w-4" />}
        />
      </div>

      <div
        className="rounded-2xl border bg-card overflow-hidden"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Tratamento</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Próxima tentativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!props.isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  Nenhum tratamento em acompanhamento.
                </TableCell>
              </TableRow>
            )}
            {pag.pageItems.map(({ p, prox, pendente }) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.paciente}</TableCell>
                <TableCell>{p.tratamento}</TableCell>
                <TableCell className="text-right">
                  {p.valor_estimado != null ? brl(p.valor_estimado) : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    Fase {prox.fase} · tentativa {prox.numeroNaFase}
                  </Badge>
                </TableCell>
                <TableCell
                  className={cn(
                    pendente ? "text-destructive font-medium" : "text-muted-foreground",
                  )}
                >
                  {formatDateBR(prox.dataPrevista)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditarPropostaButton proposta={p} />
                    <ContatadoButton proposta={p} />
                    <FecharButton proposta={p} />
                    <ConfirmDelete
                      title="Marcar como recusado?"
                      description={`"${p.tratamento}" de ${p.paciente} sairá do acompanhamento.`}
                      onConfirm={() => marcarStatus(p.id, "recusado")}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
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
          unitLabel="propostas"
        />
      </div>
    </>
  );
}
