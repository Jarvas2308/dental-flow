export const brl = (v: number | string | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

// Converte uma data armazenada (YYYY-MM-DD) em Date no fuso LOCAL, sem
// deslocamento de timezone. Aceita também ISO completo e objetos Date.
export const parseLocalDate = (d: Date | string | null | undefined): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const parsed = new Date(d);
  return isNaN(+parsed) ? null : parsed;
};

// String YYYY-MM-DD a partir de um Date (sem UTC), pronta para salvar no Supabase.
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Data de hoje em YYYY-MM-DD no fuso local.
export const todayISO = () => toISODate(new Date());

// Exibição DD/MM/YYYY sem deslocamento de dia.
export const formatDateBR = (d: Date | string | null | undefined) => {
  const dt = parseLocalDate(d);
  if (!dt) return "";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
};

export const monthKey = (d: Date | string) => {
  const dt = typeof d === "string" ? (parseLocalDate(d) ?? new Date(d)) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
};

export const currentMonthKey = () => monthKey(new Date());

// Início (domingo, 00:00) e fim (sábado, 23:59:59.999) da semana local que
// contém a data informada.
export const startOfWeek = (d: Date) => {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
};

export const endOfWeek = (d: Date) => {
  const dt = startOfWeek(d);
  dt.setDate(dt.getDate() + 6);
  dt.setHours(23, 59, 59, 999);
  return dt;
};

export const monthOptions = (count = 12) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return monthKey(d);
  });
};

// Mesma lista, garantindo que o mês atualmente selecionado esteja presente.
// Um link compartilhado com um mês fora da janela padrão (ex.: ?mes=2024-03)
// deixaria o <Select> com o gatilho em branco, embora a tela mostre os dados
// corretos daquele mês.
export const monthOptionsIncluding = (mes: string, count = 12) => {
  const base = monthOptions(count);
  return base.includes(mes) ? base : [...base, mes].sort().reverse();
};
