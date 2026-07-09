import { supabase } from "@/integrations/supabase/client";

/**
 * Normaliza o nome do paciente da mesma forma usada no fluxo de atendimento:
 * remove espaços nas pontas e colapsa espaços internos.
 */
export const normalizePacienteNome = (nome: string) =>
  nome.replace(/\s+/g, " ").trim();

/**
 * Resolve o `paciente_id` para um nome de paciente, reutilizando a mesma lógica
 * de normalização do atendimento para evitar duplicados. Se já houver um id
 * conhecido, retorna-o. Caso contrário procura na lista carregada, depois no
 * banco e, por fim, cria um novo paciente.
 *
 * @returns o id do paciente ou `null` quando não há nome.
 * @throws quando a busca ou criação falha (o chamador deve tratar).
 */
export async function resolvePacienteId(opts: {
  nome: string;
  userId: string;
  knownId?: string | null;
  cache?: Array<{ id: string; nome: string | null }>;
}): Promise<string | null> {
  const nome = normalizePacienteNome(opts.nome);
  if (!nome) return null;
  if (opts.knownId) return opts.knownId;

  const nomeKey = nome.toLowerCase();

  // 1) Busca na lista já carregada.
  const existente = (opts.cache ?? []).find(
    (p) => (p.nome ?? "").replace(/\s+/g, " ").trim().toLowerCase() === nomeKey,
  );
  if (existente) return existente.id;

  // 2) Confirmação pontual no banco.
  const { data: encontrados, error: buscaError } = await supabase
    .from("pacientes")
    .select("id, nome")
    .ilike("nome", nome);
  if (buscaError) throw buscaError;
  const match = (encontrados ?? []).find(
    (p: any) => (p.nome ?? "").replace(/\s+/g, " ").trim().toLowerCase() === nomeKey,
  );
  if (match) return match.id;

  // 3) Cria o paciente quando nenhuma correspondência foi encontrada.
  const { data, error } = await supabase
    .from("pacientes")
    .insert({ nome, user_id: opts.userId })
    .select()
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

/**
 * Constrói um contador de registros por paciente que prioriza `paciente_id`
 * e usa o nome normalizado apenas como fallback para registros antigos sem id.
 * As duas chaves são disjuntas por registro, evitando dupla contagem.
 *
 * Aceita várias fontes (atendimentos, consultas, propostas) que exponham
 * `paciente_id` e/ou `paciente` (texto).
 */
export function buildPacienteHistoryCounter(
  sources: Array<Array<{ paciente_id?: string | null; paciente?: string | null }> | undefined>,
) {
  const byId: Record<string, number> = {};
  const byName: Record<string, number> = {};
  for (const source of sources) {
    for (const r of source ?? []) {
      if (r.paciente_id) {
        byId[r.paciente_id] = (byId[r.paciente_id] ?? 0) + 1;
      } else {
        const k = normalizePacienteNome(r.paciente ?? "").toLowerCase();
        if (!k) continue;
        byName[k] = (byName[k] ?? 0) + 1;
      }
    }
  }
  return (p: { id: string; nome?: string | null }) =>
    (byId[p.id] ?? 0) +
    (byName[normalizePacienteNome(p.nome ?? "").toLowerCase()] ?? 0);
}
