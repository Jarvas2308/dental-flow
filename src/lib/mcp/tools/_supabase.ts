import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

// Build a Supabase client scoped to the authenticated MCP user so RLS runs
// as that user. The raw token is forwarded to Supabase only — never returned.
export function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function unauthenticated() {
  return {
    content: [{ type: "text" as const, text: "Não autenticado." }],
    isError: true,
  };
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export function formatBRL(value: number) {
  return brl.format(value || 0);
}

// Primeiro dia (YYYY-MM-DD) do mês seguinte ao informado (YYYY-MM).
export function nextMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
