import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, formatBRL } from "./_supabase";

export default defineTool({
  name: "list_atendimentos",
  title: "Listar atendimentos",
  description:
    "Lista os atendimentos do consultório do usuário autenticado, opcionalmente filtrados por mês (AAAA-MM) e/ou status de pagamento.",
  inputSchema: {
    month: z
      .string()
      .optional()
      .describe("Filtro de mês no formato AAAA-MM, por exemplo 2026-07."),
    status_pagamento: z
      .string()
      .optional()
      .describe("Filtro por status de pagamento, por exemplo 'pago' ou 'pendente'."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Número máximo de registros a retornar (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month, status_pagamento, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("atendimentos")
      .select(
        "id, data, paciente, procedimento, valor_bruto, valor_liquido, forma_pagamento, status_pagamento, nota_fiscal",
      )
      .order("data", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));

    if (status_pagamento) query = query.eq("status_pagamento", status_pagamento);
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      query = query.gte("data", `${month}-01`).lt("data", nextMonth(month));
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const total = rows.reduce((s, r) => s + (r.valor_liquido ?? 0), 0);
    const text =
      rows.length === 0
        ? "Nenhum atendimento encontrado."
        : rows
            .map(
              (r) =>
                `${r.data} — ${r.paciente} — ${r.procedimento} — bruto ${formatBRL(r.valor_bruto)} / líquido ${formatBRL(r.valor_liquido)} — ${r.status_pagamento}`,
            )
            .join("\n") + `\n\nTotal líquido: ${formatBRL(total)} (${rows.length} atendimentos)`;

    return {
      content: [{ type: "text", text }],
      structuredContent: { atendimentos: rows, total_liquido: total },
    };
  },
});

function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
