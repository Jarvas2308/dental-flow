// Parsers para os search params das rotas. O search de uma URL é entrada
// externa: pode vir de um link compartilhado, de um favorito antigo ou de
// alguém editando a barra de endereços. Nenhum destes pode derrubar a tela —
// valor inválido vira `undefined` e a tela cai no seu padrão.

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Aceita apenas "YYYY-MM" válido. "2026-13", "banana", array ou número viram
// undefined, e a tela usa o mês corrente.
export const parseMes = (v: unknown): string | undefined =>
  typeof v === "string" && MES_RE.test(v) ? v : undefined;

// Texto livre (busca, nome de procedimento). Limita o tamanho para não
// carregar uma URL absurda para dentro de um filtro.
export const parseTexto = (v: unknown, maxLen = 120): string | undefined =>
  typeof v === "string" && v.length > 0 && v.length <= maxLen ? v : undefined;

// Valida contra um conjunto fechado de opções (ordenação, filtros, status).
export const parseOpcao = <T extends string>(v: unknown, opcoes: readonly T[]): T | undefined =>
  typeof v === "string" && (opcoes as readonly string[]).includes(v) ? (v as T) : undefined;
