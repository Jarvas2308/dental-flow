import { describe, it, expect } from "vitest";
import { pertenceAoPaciente } from "./paciente-detalhe";

describe("pertenceAoPaciente — filtragem de registros legados", () => {
  const paciente = {
    id: "p-1",
    nome: "Carlos Silva",
    created_at: "2026-01-01T00:00:00Z",
    user_id: "u-1",
  };

  it("inclui registro com paciente_id que bate", () => {
    const atend = {
      id: "at-1",
      paciente_id: "p-1",
      paciente: "Carlos Silva",
      data: "2026-07-01",
      valor_bruto: 500,
      valor_liquido: 500,
      taxa: 0,
      forma_pagamento: "Pix",
      status_pagamento: "pago",
      parcelado: false,
      parcelas_total: 1,
      nota_fiscal_status: "pendente",
      created_at: "x",
      user_id: "u-1",
      procedimento: "Limpeza",
    };
    expect(pertenceAoPaciente(atend, paciente)).toBe(true);
  });

  it("inclui registro legado (sem paciente_id) com nome normalizado que bate", () => {
    const atend = {
      id: "at-1",
      paciente_id: null,
      paciente: "CARLOS SILVA",
      data: "2026-07-01",
      valor_bruto: 500,
      valor_liquido: 500,
      taxa: 0,
      forma_pagamento: "Pix",
      status_pagamento: "pago",
      parcelado: false,
      parcelas_total: 1,
      nota_fiscal_status: "pendente",
      created_at: "x",
      user_id: "u-1",
      procedimento: "Limpeza",
    };
    expect(pertenceAoPaciente(atend, paciente)).toBe(true);
  });

  it("exclui registro de outro paciente (paciente_id diferente)", () => {
    const atend = {
      id: "at-1",
      paciente_id: "p-2",
      paciente: "Outro Paciente",
      data: "2026-07-01",
      valor_bruto: 500,
      valor_liquido: 500,
      taxa: 0,
      forma_pagamento: "Pix",
      status_pagamento: "pago",
      parcelado: false,
      parcelas_total: 1,
      nota_fiscal_status: "pendente",
      created_at: "x",
      user_id: "u-1",
      procedimento: "Limpeza",
    };
    expect(pertenceAoPaciente(atend, paciente)).toBe(false);
  });

  it("exclui registro legado de outro paciente (nome não bate)", () => {
    const atend = {
      id: "at-1",
      paciente_id: null,
      paciente: "Maria Clara",
      data: "2026-07-01",
      valor_bruto: 500,
      valor_liquido: 500,
      taxa: 0,
      forma_pagamento: "Pix",
      status_pagamento: "pago",
      parcelado: false,
      parcelas_total: 1,
      nota_fiscal_status: "pendente",
      created_at: "x",
      user_id: "u-1",
      procedimento: "Limpeza",
    };
    expect(pertenceAoPaciente(atend, paciente)).toBe(false);
  });

  it("trata paciente_id null como legado (usa nome)", () => {
    const atend = {
      id: "at-1",
      paciente_id: null,
      paciente: "Carlos Silva",
      data: "2026-07-01",
      valor_bruto: 500,
      valor_liquido: 500,
      taxa: 0,
      forma_pagamento: "Pix",
      status_pagamento: "pago",
      parcelado: false,
      parcelas_total: 1,
      nota_fiscal_status: "pendente",
      created_at: "x",
      user_id: "u-1",
      procedimento: "Limpeza",
    };
    // null === null é true, então deve usar nome para comparar
    expect(pertenceAoPaciente(atend, paciente)).toBe(true);
  });
});
