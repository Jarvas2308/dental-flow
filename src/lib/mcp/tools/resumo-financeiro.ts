import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resumoMensal } from "@/lib/finance";
import { supabaseForUser, unauthenticated, formatBRL, carregarDadosDoMes } from "./_supabase";

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro do mês",
  description:
    "Retorna o resumo financeiro de um mês (AAAA-MM): recebimentos efetivos, ganhos extras, despesas pagas, despesas pendentes, custos de laboratório, caixa realizado e resultado previsto. Os números são os mesmos exibidos no Dashboard.",
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

    let dados;
    try {
      dados = await carregarDadosDoMes(supabaseForUser(ctx), month);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar os dados do mês.";
      return { content: [{ type: "text", text: msg }], isError: true };
    }

    const r = resumoMensal(dados, month);

    const text = [
      `Resumo financeiro de ${month}:`,
      `- Recebido bruto: ${formatBRL(r.recebidoBruto)}`,
      `- Recebido líquido: ${formatBRL(r.recebidoLiquido)}`,
      `- Ganhos extras: ${formatBRL(r.ganhos)}`,
      `- Receita total: ${formatBRL(r.receitaTotal)}`,
      `- Despesas pagas: ${formatBRL(r.despesasPagas)}`,
      `- Custos de laboratório: ${formatBRL(r.custosLaboratorio)}`,
      `- Despesas pendentes: ${formatBRL(r.despesasPendentes)}`,
      `- Caixa realizado: ${formatBRL(r.caixaRealizado)}`,
      `- Resultado previsto: ${formatBRL(r.resultadoPrevisto)}`,
    ].join("\n");

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        month,
        recebido_bruto: r.recebidoBruto,
        recebido_liquido: r.recebidoLiquido,
        ganhos_extras: r.ganhos,
        receita_total: r.receitaTotal,
        despesas_pagas: r.despesasPagas,
        custos_laboratorio: r.custosLaboratorio,
        despesas_pendentes: r.despesasPendentes,
        caixa_realizado: r.caixaRealizado,
        resultado_previsto: r.resultadoPrevisto,
      },
    };
  },
});
