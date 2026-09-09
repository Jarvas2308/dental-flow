import { describe, it, expect } from "vitest";
import { carregarDadosDoMes } from "./_supabase";
import { fakeSupabase, type Row } from "./fake-postgrest";
import { resumoMensal } from "@/lib/finance";

// Guarda de regressão do defeito que motivou `resumoMensal`: a ferramenta MCP
// `resumo_financeiro` refazia a conta do mês em SQL e devolvia um caixa
// diferente do que o Dashboard mostrava para o mesmo mês.
//
// O Dashboard tem todas as linhas em memória e chama `resumoMensal` sobre
// elas. A ferramenta MCP precisa carregar do banco EXATAMENTE o mesmo conjunto
// relevante — é isso que `carregarDadosDoMes` faz e é isso que este arquivo
// verifica: os dois caminhos, mesmo mês, mesmos números.

const MES = "2026-07";

// Atendimento à vista de julho cujo único recebimento caiu em AGOSTO.
// `receitasRecebidas` escolhe o ramo por `recs.length > 0`, então se a consulta
// trouxesse apenas os recebimentos de julho este atendimento cairia no ramo
// "sem recebimentos" e seria contado pela data do atendimento — divergindo.
const atendVistaRecebeDepois = {
  id: "at-vista-tardio",
  data: "2026-07-05",
  parcelado: false,
  status_pagamento: "pago",
  valor_bruto: 300,
  valor_liquido: 300,
  taxa: 0,
  paciente: "Ana",
  procedimento: "Limpeza",
  forma_pagamento: "pix",
};

// Atendimento de MAIO cujo recebimento caiu em julho: precisa ser descoberto
// pelo recebimento, não pela data do atendimento.
const atendAntigoRecebeAgora = {
  id: "at-antigo",
  data: "2026-05-20",
  parcelado: true,
  status_pagamento: "pendente",
  valor_bruto: 1000,
  valor_liquido: 1000,
  taxa: 0,
  paciente: "Bruno",
  procedimento: "Canal",
  forma_pagamento: "cartao",
};

// Atendimento legado de abril com parcela paga em julho, sem linha em
// `recebimentos`.
const atendLegado = {
  id: "at-legado",
  data: "2026-04-02",
  parcelado: true,
  status_pagamento: "parcial",
  valor_bruto: 800,
  valor_liquido: 800,
  taxa: 0,
  paciente: "Carla",
  procedimento: "Prótese",
  forma_pagamento: "boleto",
};

const atendimentos = [atendVistaRecebeDepois, atendAntigoRecebeAgora, atendLegado];

const recebimentos = [
  {
    id: "r-ago",
    atendimento_id: "at-vista-tardio",
    data: "2026-08-02",
    valor: 300,
    valor_liquido: 300,
  },
  {
    id: "r-jul",
    atendimento_id: "at-antigo",
    data: "2026-07-18",
    valor: 400,
    valor_liquido: 400,
  },
];

const parcelas = [
  {
    id: "p-jul",
    atendimento_id: "at-legado",
    numero: 1,
    total: 2,
    status: "pago",
    vencimento: "2026-07-10",
    data_pagamento: "2026-07-10",
    valor_bruto: 400,
    valor_liquido: 400,
  },
  {
    id: "p-ago",
    atendimento_id: "at-legado",
    numero: 2,
    total: 2,
    status: "pendente",
    vencimento: "2026-08-10",
    data_pagamento: null,
    valor_bruto: 400,
    valor_liquido: 400,
  },
];

const despesas = [
  {
    id: "d-paga",
    status: "pago",
    valor: 120,
    vencimento: "2026-07-01",
    data_pagamento: "2026-07-03",
  },
  {
    id: "d-pend",
    status: "pendente",
    valor: 80,
    vencimento: "2026-07-25",
    data_pagamento: null,
  },
  // Vencida em junho, paga em julho: entra em julho pela data de pagamento.
  {
    id: "d-atravessada",
    status: "pago",
    valor: 60,
    vencimento: "2026-06-28",
    data_pagamento: "2026-07-02",
  },
  // Marcada como paga sem data: `finance.ts` ainda a conta como pendente.
  {
    id: "d-sem-data",
    status: "pago",
    valor: 50,
    vencimento: "2026-07-30",
    data_pagamento: null,
  },
];

const receitasExtras = [{ id: "g-1", data: "2026-07-11", valor: 200 }];
const custosLaboratorio = [{ id: "l-1", data: "2026-07-12", valor: 90 }];

const tabelas: Record<string, Row[]> = {
  atendimentos,
  recebimentos,
  parcelas,
  despesas,
  receitas_extras: receitasExtras,
  custos_laboratorio: custosLaboratorio,
};

// O que o Dashboard faria: todas as linhas em memória, uma chamada.
const referencia = resumoMensal(
  {
    atendimentos,
    recebimentos,
    parcelas,
    despesas,
    ganhos: receitasExtras,
    lab: custosLaboratorio,
  },
  MES,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supa = (maxRows?: number) => fakeSupabase(tabelas, maxRows) as any;

describe("carregarDadosDoMes + resumoMensal", () => {
  it("produz os mesmos números que o Dashboard para o mesmo mês", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    expect(resumoMensal(dados, MES)).toEqual(referencia);
  });

  it("traz o recebimento de outro mês do atendimento à vista de julho", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    const ids = dados.recebimentos.map((r) => r.id);
    expect(ids).toContain("r-ago");
  });

  it("descobre o atendimento antigo pelo recebimento que caiu no mês", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    expect(dados.atendimentos.map((a) => a.id)).toContain("at-antigo");
  });

  it("descobre o atendimento legado pela parcela paga no mês", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    expect(dados.atendimentos.map((a) => a.id)).toContain("at-legado");
  });

  it("não duplica atendimento que é do mês E dono de recebimento do mês", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    const ids = dados.atendimentos.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("traz ganhos extras e custos de laboratório, ignorados pela versão antiga", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    const r = resumoMensal(dados, MES);
    expect(r.ganhos).toBe(200);
    expect(r.custosLaboratorio).toBe(90);
  });

  it("conta a despesa vencida em junho e paga em julho", async () => {
    const dados = await carregarDadosDoMes(supa(), MES);
    expect(resumoMensal(dados, MES).despesasPagas).toBe(180);
  });

  it("fecha os mesmos números com o teto de linhas do PostgREST em 1", async () => {
    // Com `max-rows = 1` toda consulta é cortada. Só a paginação de
    // `fetchAllPages` mantém o resultado completo.
    const dados = await carregarDadosDoMes(supa(1), MES);
    expect(resumoMensal(dados, MES)).toEqual(referencia);
  });

  it("mês sem movimento zera tudo", async () => {
    const dados = await carregarDadosDoMes(supa(), "2026-12");
    const r = resumoMensal(dados, "2026-12");
    expect(r.receitaTotal).toBe(0);
    expect(r.caixaRealizado).toBe(0);
  });
});
