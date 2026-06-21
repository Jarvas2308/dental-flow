import { parseLocalDate, toISODate, todayISO } from "@/lib/format";

export type ProximaTentativa = {
  fase: 1 | 2 | 3;
  dataPrevista: string;
  numeroNaFase: number;
};

// Determina a fase atual, o número da tentativa dentro da fase e a próxima
// data prevista para um tratamento proposto em acompanhamento.
export function proximaTentativa(proposta: any, tentativas: any[]): ProximaTentativa {
  const feitas = Number(proposta?.tentativas_feitas ?? 0);
  const f1qtd = Number(proposta?.fase1_qtd ?? 0);
  const f2qtd = Number(proposta?.fase2_qtd ?? 0);

  let fase: 1 | 2 | 3;
  let numeroNaFase: number;
  let intervalo: number;

  if (feitas < f1qtd) {
    fase = 1;
    numeroNaFase = feitas + 1;
    intervalo = Number(proposta?.fase1_intervalo_dias ?? 0);
  } else if (feitas < f1qtd + f2qtd) {
    fase = 2;
    numeroNaFase = feitas - f1qtd + 1;
    intervalo = Number(proposta?.fase2_intervalo_dias ?? 0);
  } else {
    fase = 3;
    numeroNaFase = feitas - f1qtd - f2qtd + 1;
    intervalo = Number(proposta?.fase3_intervalo_dias ?? 0);
  }

  // Data base: a tentativa mais recente, ou a data da proposta se não houver.
  let base = proposta?.data_proposta as string;
  if (tentativas && tentativas.length > 0) {
    const maisRecente = tentativas.reduce((acc, t) =>
      (t.data ?? "") > (acc.data ?? "") ? t : acc,
    );
    base = maisRecente.data;
  }

  const baseDate = parseLocalDate(base) ?? new Date();
  baseDate.setDate(baseDate.getDate() + intervalo);
  const dataPrevista = toISODate(baseDate);

  return { fase, dataPrevista, numeroNaFase };
}

// Retorna true se a data prevista já venceu ou é hoje.
export function estaPendenteHoje(dataPrevista: string): boolean {
  return dataPrevista <= todayISO();
}
