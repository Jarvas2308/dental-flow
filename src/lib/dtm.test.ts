import { describe, it, expect } from "vitest";
import { sortDtmAcompanhamentos } from "./dtm";

// Valida que a sequência dos acompanhamentos DTM segue data_inicio (ASC),
// desempata por created_at, e joga nulos para o final — independente da
// ordem de inserção. Não altera banco nem lógica financeira.
describe("sortDtmAcompanhamentos", () => {
  it("ordena por data_inicio ASC, ignorando ordem de inserção", () => {
    const rows = [
      { id: "c", data_inicio: "2026-05-10", created_at: "2026-01-01" },
      { id: "a", data_inicio: "2025-01-15", created_at: "2026-06-01" },
      { id: "b", data_inicio: "2025-12-01", created_at: "2026-03-01" },
    ];
    expect(sortDtmAcompanhamentos(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("empata data_inicio usando created_at ASC como critério secundário", () => {
    const rows = [
      { id: "y", data_inicio: "2026-01-10", created_at: "2026-02-02" },
      { id: "x", data_inicio: "2026-01-10", created_at: "2026-02-01" },
    ];
    expect(sortDtmAcompanhamentos(rows).map((r) => r.id)).toEqual(["x", "y"]);
  });

  it("joga acompanhamentos sem data_inicio para o final", () => {
    const rows = [
      { id: "nulo", data_inicio: null, created_at: "2020-01-01" },
      { id: "novo", data_inicio: "2026-08-01", created_at: "2026-08-01" },
      { id: "antigo", data_inicio: "2024-01-01", created_at: "2024-01-01" },
    ];
    expect(sortDtmAcompanhamentos(rows).map((r) => r.id)).toEqual(["antigo", "novo", "nulo"]);
  });

  it("não muta o array original", () => {
    const rows = [
      { id: "b", data_inicio: "2026-02-01", created_at: "2026-01-01" },
      { id: "a", data_inicio: "2026-01-01", created_at: "2026-01-01" },
    ];
    const original = rows.map((r) => r.id);
    sortDtmAcompanhamentos(rows);
    expect(rows.map((r) => r.id)).toEqual(original);
  });
});
