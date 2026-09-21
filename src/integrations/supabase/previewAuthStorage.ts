// Fora do Lovable não existe broker de sessão por postMessage: a sessão do
// Supabase fica no localStorage do próprio domínio. Retornar undefined faz o
// supabase-js usar o storage padrão dele (localStorage no browser, memória no SSR).
export function brokeredPreviewStorage() {
  return undefined;
}
