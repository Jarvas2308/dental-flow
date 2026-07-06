import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated, formatBRL } from "./_supabase";

export default defineTool({
  name: "list_despesas",
  title: "Listar despesas",
  description:
    "Lista as despesas do usuário autenticado, opcionalmente filtradas por status (pago, pendente, atrasado).",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Filtro por status: 'pago', 'pendente' ou 'atrasado'."),
    limit: z
      .number()
      .int()
      .optional()
      .describe("Número máximo de registros a retornar (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("despesas")
      .select("id, nome, valor, status, vencimento, data_pagamento, recorrente")
      .order("vencimento", { ascending: false })
      .limit(Math.min(Math.max(limit ?? 50, 1), 200));
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const total = rows.reduce((s, r) => s + (r.valor ?? 0), 0);
    const text =
      rows.length === 0
        ? "Nenhuma despesa encontrada."
        : rows
            .map(
              (r) =>
                `${r.vencimento} — ${r.nome} — ${formatBRL(r.valor ?? 0)} — ${r.status}${r.data_pagamento ? ` (pago em ${r.data_pagamento})` : ""}`,
            )
            .join("\n") + `\n\nTotal: ${formatBRL(total)} (${rows.length} despesas)`;

    return {
      content: [{ type: "text", text }],
      structuredContent: { despesas: rows, total },
    };
  },
});
