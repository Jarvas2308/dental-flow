import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listAtendimentos from "./tools/list-atendimentos";
import listDespesas from "./tools/list-despesas";
import resumoFinanceiro from "./tools/resumo-financeiro";

// The OAuth issuer must be the direct Supabase host. The project ref is the
// only Supabase value that survives publish unchanged. VITE_SUPABASE_PROJECT_ID
// is inlined as a literal by Vite at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "odonto-financeiro-mcp",
  title: "Odonto Financeiro MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do sistema financeiro odontológico. Use `list_atendimentos` para atendimentos, `list_despesas` para despesas e `resumo_financeiro` para o resumo mensal (recebido, despesas pagas/pendentes, caixa realizado).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listAtendimentos, listDespesas, resumoFinanceiro],
});
