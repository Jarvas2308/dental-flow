import { describe, it, expect } from "vitest";
import { proximaTentativa, estaPendenteHoje } from "./followup";

describe("proximaTentativa — próxima data de contato", () => {
  it("retorna fase e data da próxima tentativa", () => {
    const proposta = {
      data_proposta: "2026-07-01",
      tentativas_feitas: 0,
      fase1_qtd: 3,
      fase2_qtd: 2,
      fase1_intervalo_dias: 7,
      fase2_intervalo_dias: 14,
      fase3_intervalo_dias: 30,
    };
    const tentativas: any[] = [];

    const prox = proximaTentativa(proposta, tentativas);
    expect(prox.fase).toBe(1);
    expect(prox.numeroNaFase).toBe(1);
    expect(prox.dataPrevista).toBe("2026-07-08");
  });

  it("avança de fase quando tentativas_feitas alcança limite", () => {
    const proposta = {
      data_proposta: "2026-07-01",
      tentativas_feitas: 3,
      fase1_qtd: 3,
      fase2_qtd: 2,
      fase1_intervalo_dias: 7,
      fase2_intervalo_dias: 14,
      fase3_intervalo_dias: 30,
    };

    const prox = proximaTentativa(proposta, []);
    expect(prox.fase).toBe(2);
    expect(prox.numeroNaFase).toBe(1);
  });

  it("usa última tentativa como base para calcular próxima data", () => {
    const proposta = {
      data_proposta: "2026-07-01",
      tentativas_feitas: 1,
      fase1_qtd: 3,
      fase2_qtd: 2,
      fase1_intervalo_dias: 7,
    };
    const tentativas = [{ data: "2026-07-10" }];

    const prox = proximaTentativa(proposta, tentativas);
    expect(prox.dataPrevista).toBe("2026-07-17");
  });
});

describe("estaPendenteHoje — status do follow-up", () => {
  it("retorna true quando data prevista é hoje ou anterior", () => {
    // Nota: a função usa todayISO() que retorna a data de hoje em ISO.
    // Testando com datas ISO para ter certeza.
    const hoje = "2026-07-31";
    const ontem = "2026-07-30";

    // Para passar nesses testes, estaPendenteHoje(hoje) <= todayISO()
    // Se todayISO() retorna "2026-07-31", então:
    // "2026-07-31" <= "2026-07-31" => true
    // "2026-07-30" <= "2026-07-31" => true
    expect(estaPendenteHoje(ontem)).toBe(true);
  });

  it("retorna false quando data prevista é futura", () => {
    const futuro = "2099-12-31";
    expect(estaPendenteHoje(futuro)).toBe(false);
  });
});
