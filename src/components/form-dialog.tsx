import { useState, type ReactNode } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";

export type FieldDef =
  | { name: string; label: string; type: "text" | "number" | "date"; required?: boolean; step?: string }
  | { name: string; label: string; type: "textarea"; required?: boolean }
  | { name: string; label: string; type: "select"; options: { label: string; value: string }[]; required?: boolean }
  | { name: string; label: string; type: "switch" };

export function FormDialog({
  title, fields, onSubmit, defaults = {}, trigger, busy,
}: {
  title: string;
  fields: FieldDef[];
  defaults?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  trigger?: ReactNode;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, any>>(defaults);

  const reset = () => setValues(defaults);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); else setValues(defaults); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button><Plus className="h-4 w-4" /> Novo</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={f.name}>{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea id={f.name} value={values[f.name] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} />
              ) : f.type === "select" ? (
                <Select value={values[f.name] ?? ""} onValueChange={(v) => setValues({ ...values, [f.name]: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : f.type === "switch" ? (
                <div className="flex items-center gap-2">
                  <input id={f.name} type="checkbox" checked={!!values[f.name]}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                    className="h-4 w-4 rounded border-input" />
                  <span className="text-sm text-muted-foreground">Sim</span>
                </div>
              ) : (
                <Input id={f.name} type={f.type} step={(f as any).step}
                  required={f.required} value={values[f.name] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.name]: f.type === "number" ? e.target.value : e.target.value })} />
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
