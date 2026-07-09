import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, formatBRL } from "./_supabase";

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro do mês",
  description:
    "Retorna o resumo financeiro de um mês (AAAA-MM): recebimentos efetivos, despesas pagas, despesas pendentes e caixa realizado.",
  inputSchema: {
    month: z.string().describe("Mês no formato AAAA-MM, por exemplo 2026-07."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return {
        content: [{ type: "text", text: "Mês inválido. Use o formato AAAA-MM." }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const start = `${month}-01`;
    const end = nextMonth(month);

    const [receb, despPagas, despPend] = await Promise.all([
      supabase
        .from("recebimentos")
        .select("valor, valor_liquido")
        .gte("data", start)
        .lt("data", end),
      supabase
        .from("despesas")
        .select("valor")
        .eq("status", "pago")
        .gte("data_pagamento", start)
        .lt("data_pagamento", end),
      supabase
        .from("despesas")
        .select("valor")
        .neq("status", "pago")
        .gte("vencimento", start)
        .lt("vencimento", end),
    ]);

    const err = receb.error || despPagas.error || despPend.error;
    if (err) return { content: [{ type: "text", text: err.message }], isError: true };

    const recebidoLiquido = (receb.data ?? []).reduce((s, r) => s + (r.valor_liquido ?? 0), 0);
    const recebidoBruto = (receb.data ?? []).reduce((s, r) => s + (r.valor ?? 0), 0);
    const totalPagas = (despPagas.data ?? []).reduce((s, r) => s + (r.valor ?? 0), 0);
    const totalPendentes = (despPend.data ?? []).reduce((s, r) => s + (r.valor ?? 0), 0);
    const caixaRealizado = recebidoLiquido - totalPagas;
    const resultadoPrevisto = caixaRealizado - totalPendentes;

    const text = [
      `Resumo financeiro de ${month}:`,
      `- Recebido bruto: ${formatBRL(recebidoBruto)}`,
      `- Recebido líquido: ${formatBRL(recebidoLiquido)}`,
      `- Despesas pagas: ${formatBRL(totalPagas)}`,
      `- Despesas pendentes: ${formatBRL(totalPendentes)}`,
      `- Caixa realizado: ${formatBRL(caixaRealizado)}`,
      `- Resultado previsto: ${formatBRL(resultadoPrevisto)}`,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        month,
        recebido_bruto: recebidoBruto,
        recebido_liquido: recebidoLiquido,
        despesas_pagas: totalPagas,
        despesas_pendentes: totalPendentes,
        caixa_realizado: caixaRealizado,
        resultado_previsto: resultadoPrevisto,
      },
    };
  },
});
