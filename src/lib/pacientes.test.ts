import { describe, it, expect, beforeEach, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { resetSupabaseMock, setTableData, spies } from "@/test/supabase-mock";
import {
  normalizePacienteNome,
  escapeIlike,
  resolvePacienteId,
  buildPacienteHistoryCounter,
} from "./pacientes";

describe("normalizePacienteNome", () => {
  it("apara as pontas e colapsa espaços internos", () => {
    expect(normalizePacienteNome("  Ana   Maria  Silva ")).toBe("Ana Maria Silva");
  });
});

describe("escapeIlike", () => {
  it("escapa os curingas do PostgREST", () => {
    // Sem isso, um nome com "%" viraria pattern e casaria com qualquer coisa.
    expect(escapeIlike("100% Ana_B")).toBe("100\\% Ana\\_B");
  });
});

describe("resolvePacienteId", () => {
  beforeEach(() => {
    resetSupabaseMock();
    setTableData("pacientes", []);
  });

  it("devolve null e não escreve nada quando o nome é vazio", async () => {
    expect(await resolvePacienteId({ nome: "   ", userId: "u1" })).toBeNull();
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("devolve o id conhecido sem consultar o banco", async () => {
    const from = vi.spyOn(supabase, "from");

    expect(await resolvePacienteId({ nome: "Ana", userId: "u1", knownId: "p-9" })).toBe("p-9");
    expect(from).not.toHaveBeenCalled();
    from.mockRestore();
  });

  it("acha na lista já carregada, ignorando caixa e espaços extras", async () => {
    const id = await resolvePacienteId({
      nome: "  ana   maria ",
      userId: "u1",
      cache: [{ id: "p-1", nome: "Ana Maria" }],
    });

    expect(id).toBe("p-1");
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("acha no banco quando não está na lista carregada", async () => {
    setTableData("pacientes", [{ id: "p-2", nome: "Ana  Maria" }]);

    const id = await resolvePacienteId({ nome: "ANA MARIA", userId: "u1", cache: [] });

    expect(id).toBe("p-2");
    expect(spies.insert).not.toHaveBeenCalled();
  });

  it("cria o paciente com o nome normalizado quando não existe", async () => {
    const id = await resolvePacienteId({ nome: "  Bruno   Costa ", userId: "u1", cache: [] });

    expect(spies.insert).toHaveBeenCalledWith("pacientes", {
      nome: "Bruno Costa",
      user_id: "u1",
    });
    expect(id).toBe("mock-id");
  });

  it("não cria duplicado quando o banco tem o nome com espaçamento diferente", async () => {
    setTableData("pacientes", [{ id: "p-3", nome: " Bruno  Costa " }]);

    await resolvePacienteId({ nome: "Bruno Costa", userId: "u1", cache: [] });

    expect(spies.insert).not.toHaveBeenCalled();
  });
});

describe("buildPacienteHistoryCounter", () => {
  it("conta por id e cai no nome só para registros legados sem paciente_id", () => {
    const contar = buildPacienteHistoryCounter([
      [{ paciente_id: "p-1", paciente: "Ana" }, { paciente: "Ana" }],
      [{ paciente_id: "p-1" }],
    ]);

    // 2 por id + 1 pelo nome, sem dupla contagem do registro que tem id.
    expect(contar({ id: "p-1", nome: "Ana" })).toBe(3);
  });

  it("não conta registros de outro paciente", () => {
    const contar = buildPacienteHistoryCounter([[{ paciente_id: "p-2", paciente: "Bruno" }]]);

    expect(contar({ id: "p-1", nome: "Ana" })).toBe(0);
  });
});
