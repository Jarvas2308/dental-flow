import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAtendimentos from "./tools/list-atendimentos";
import listDespesas from "./tools/list-despesas";
import resumoFinanceiro from "./tools/resumo-financeiro";

// O issuer OAuth precisa apontar direto para o host do Supabase. As duas
// variáveis abaixo são `VITE_`, então o Vite as inlina como literal no build.
//
// A fonte preferida é VITE_SUPABASE_URL porque é a que existe de fato em
// `.env.production`; VITE_SUPABASE_PROJECT_ID fica como compatibilidade. Antes
// só o project ref era lido e, na ausência dele, o app publicava o issuer
// `https://project-ref-unset.supabase.co/auth/v1`: o build passava e o OAuth do
// MCP falhava em produção sem nenhum sinal. Faltando as duas, falhe alto.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ?? (projectRef ? `https://${projectRef}.supabase.co` : "")
).replace(/\/+$/, "");

if (!supabaseUrl) {
  throw new Error(
    "MCP: defina VITE_SUPABASE_URL (ou VITE_SUPABASE_PROJECT_ID) para montar o issuer OAuth.",
  );
}

export default defineMcp({
  name: "odonto-financeiro-mcp",
  title: "Odonto Financeiro MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do sistema financeiro odontológico. Use `list_atendimentos` para atendimentos, `list_despesas` para despesas e `resumo_financeiro` para o resumo mensal (recebido, despesas pagas/pendentes, caixa realizado).",
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAtendimentos, listDespesas, resumoFinanceiro],
});
