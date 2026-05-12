import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

/**
 * Garante que despesas recorrentes tenham um lançamento gerado para todos os
 * meses entre a primeira ocorrência e o mês atual. Ao detectar lacunas, cria
 * automaticamente as cópias com status "pendente".
 */
export function useEnsureRecurring() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ran = useRef(false);

  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;
    (async () => {
      const { data, error } = await supabase
        .from("despesas")
        .select("*")
        .eq("recorrente", true)
        .order("vencimento", { ascending: true });
      if (error || !data) return;

      // Agrupa por cadeia (origem_id ou id base)
      const groups = new Map<string, any[]>();
      for (const d of data as any[]) {
        const key = d.origem_id ?? d.id;
        const arr = groups.get(key) ?? [];
        arr.push(d);
        groups.set(key, arr);
      }

      const now = new Date();
      const curY = now.getFullYear();
      const curM = now.getMonth(); // 0-indexed
      const inserts: any[] = [];

      for (const [key, items] of groups) {
        const meses = new Set(items.map((i) => i.vencimento.slice(0, 7)));
        const base = items[0];
        const dia = Number(base.vencimento.slice(8, 10));
        const startD = new Date(base.vencimento);
        const startY = startD.getFullYear();
        const startM = startD.getMonth();

        for (let y = startY; y <= curY; y++) {
          const mStart = y === startY ? startM : 0;
          const mEnd = y === curY ? curM : 11;
          for (let m = mStart; m <= mEnd; m++) {
            const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
            if (meses.has(ym)) continue;
            // último dia válido do mês
            const lastDay = new Date(y, m + 1, 0).getDate();
            const d = Math.min(dia, lastDay);
            const venc = `${ym}-${String(d).padStart(2, "0")}`;
            inserts.push({
              user_id: user.id,
              nome: base.nome,
              valor: base.valor,
              vencimento: venc,
              status: "pendente",
              recorrente: true,
              origem_id: key,
              observacoes: base.observacoes,
            });
          }
        }
      }

      if (inserts.length) {
        await supabase.from("despesas").insert(inserts);
        qc.invalidateQueries({ queryKey: ["despesas"] });
      }
    })();
  }, [user, qc]);
}
