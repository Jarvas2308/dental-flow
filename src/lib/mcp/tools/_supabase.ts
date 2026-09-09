import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllPages, fetchAllPorIds } from "@/lib/supabase-pagination";
import { nextMonth } from "@/lib/format";

// As variáveis `SUPABASE_*` só existem no runtime do servidor e dependem do que
// a plataforma injeta no publish. As `VITE_SUPABASE_*` são inlinadas pelo Vite
// no build, então servem de fallback garantido — são as mesmas credenciais
// publicáveis usadas pelo cliente. Sem esse fallback, o `!` daqui produzia um
// cliente com URL `undefined` e todas as ferramentas MCP falhavam em produção
// com um erro de rede sem relação aparente com configuração.
const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Build a Supabase client scoped to the authenticated MCP user so RLS runs
// as that user. The raw token is forwarded to Supabase only — never returned.
export function supabaseForUser(ctx: ToolContext) {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const faltando = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Configuração ausente: ${faltando.join(", ")}.`);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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

type Supa = ReturnType<typeof supabaseForUser>;

const unicos = (ids: (string | null | undefined)[]) => [
  ...new Set(ids.filter((id): id is string => !!id)),
];

// Carrega o conjunto de linhas necessário para `resumoMensal` fechar o mês com
// os mesmos números do Dashboard.
//
// Não basta buscar os recebimentos do mês: `receitasRecebidas` decide o ramo de
// cada atendimento por `recs.length > 0` (lib/finance.ts). Um atendimento à
// vista cujo único recebimento caiu em outro mês cairia no ramo "sem
// recebimentos" e seria contado pela data do atendimento — divergindo da tela.
// Por isso os atendimentos relevantes são descobertos primeiro e só então
// TODOS os recebimentos e parcelas deles são carregados.
export async function carregarDadosDoMes(supabase: Supa, month: string) {
  const start = `${month}-01`;
  const end = nextMonth(month);
  const porId = { ascending: true } as const;

  const [recebMes, parcMes] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("recebimentos")
        .select("atendimento_id")
        .gte("data", start)
        .lt("data", end)
        .order("id", porId)
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("parcelas")
        .select("atendimento_id")
        .or(
          `and(data_pagamento.gte.${start},data_pagamento.lt.${end}),and(data_pagamento.is.null,vencimento.gte.${start},vencimento.lt.${end})`,
        )
        .order("id", porId)
        .range(from, to),
    ),
  ]);

  const idsDoMes = unicos([
    ...recebMes.map((r) => r.atendimento_id),
    ...parcMes.map((p) => p.atendimento_id),
  ]);

  // Atendimentos do mês (ramo à vista) + os donos dos recebimentos/parcelas
  // que caíram no mês, mesmo que o atendimento seja de outro período. São duas
  // consultas em vez de um `.or()` combinado porque a lista de ids vai na URL:
  // um `id.in.(...)` com milhares de ids estoura o limite de tamanho.
  const [atendDoPeriodo, atendPorId, desp, ganhos, lab] = await Promise.all([
    fetchAllPages((from, to) =>
      supabase
        .from("atendimentos")
        .select("*")
        .gte("data", start)
        .lt("data", end)
        .order("id", porId)
        .range(from, to),
    ),
    fetchAllPorIds(idsDoMes, (bloco, from, to) =>
      supabase.from("atendimentos").select("*").in("id", bloco).order("id", porId).range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("despesas")
        .select("id, status, valor, vencimento, data_pagamento")
        .or(
          `and(vencimento.gte.${start},vencimento.lt.${end}),and(data_pagamento.gte.${start},data_pagamento.lt.${end})`,
        )
        .order("id", porId)
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("receitas_extras")
        .select("data, valor")
        .gte("data", start)
        .lt("data", end)
        .order("id", porId)
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("custos_laboratorio")
        .select("data, valor")
        .gte("data", start)
        .lt("data", end)
        .order("id", porId)
        .range(from, to),
    ),
  ]);

  const porChave = new Map([...atendDoPeriodo, ...atendPorId].map((a) => [a.id, a]));
  const atendimentos = [...porChave.values()];
  const atendIds = atendimentos.map((a) => a.id);

  const [receb, parc] = await Promise.all([
    fetchAllPorIds(atendIds, (bloco, from, to) =>
      supabase
        .from("recebimentos")
        .select("*")
        .in("atendimento_id", bloco)
        .order("id", porId)
        .range(from, to),
    ),
    fetchAllPorIds(atendIds, (bloco, from, to) =>
      supabase
        .from("parcelas")
        .select("*")
        .in("atendimento_id", bloco)
        .order("id", porId)
        .range(from, to),
    ),
  ]);

  return {
    atendimentos,
    recebimentos: receb,
    parcelas: parc,
    despesas: desp,
    ganhos,
    lab,
  };
}
