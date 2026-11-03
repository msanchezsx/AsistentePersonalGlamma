import { describe, expect, it } from "vitest";
import { ASSISTANT_TOOLS, payloadSchemas, runTool } from "@/lib/assistant/tools";

const byName = Object.fromEntries(ASSISTANT_TOOLS.map((t) => [t.name, t]));
const PROPOSALS: Record<string, keyof typeof payloadSchemas> = {
  proponer_tarea: "create_task",
  proponer_reunion: "create_meeting",
  proponer_recordar: "remember",
};

describe("herramientas del asistente", () => {
  it("todas son estrictas y piden todos sus campos", () => {
    for (const t of ASSISTANT_TOOLS) {
      expect(t.strict, t.name).toBe(true);
      const schema = t.input_schema as unknown as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(schema.additionalProperties, t.name).toBe(false);
      expect([...schema.required].sort(), t.name).toEqual(Object.keys(schema.properties).sort());
    }
  });

  it("no hay herramientas para enviar correos ni mensajes", () => {
    const names = ASSISTANT_TOOLS.map((t) => t.name).join(" ");
    expect(names).not.toMatch(/correo|email|enviar|whatsapp|borrar|eliminar/);
  });

  it("los campos de cada propuesta coinciden con su validación", () => {
    for (const [tool, kind] of Object.entries(PROPOSALS)) {
      const props = Object.keys((byName[tool].input_schema as { properties: object }).properties).sort();
      expect(Object.keys(payloadSchemas[kind].shape).sort(), tool).toEqual(props);
    }
  });

  it("valida fechas y horas de una reunión", () => {
    const ok = {
      titulo: "Junta con Ana",
      fecha: "2026-11-06",
      hora_inicio: "10:00",
      hora_fin: "",
      participantes: ["Ana"],
      lugar: "",
    };
    expect(payloadSchemas.create_meeting.safeParse(ok).success).toBe(true);
    expect(payloadSchemas.create_meeting.safeParse({ ...ok, hora_inicio: "25:00" }).success).toBe(false);
    expect(payloadSchemas.create_meeting.safeParse({ ...ok, fecha: "6/11/2026" }).success).toBe(false);
  });

  it("una tarea sin título no es válida", () => {
    const base = { titulo: "  ", descripcion: "", fecha: "", hora: "", prioridad: 3, urgente: false, importante: true };
    expect(payloadSchemas.create_task.safeParse(base).success).toBe(false);
    expect(payloadSchemas.create_task.safeParse({ ...base, titulo: "Cotizar" }).success).toBe(true);
    expect(payloadSchemas.create_task.safeParse({ ...base, titulo: "Cotizar", prioridad: 9 }).success).toBe(false);
  });

  it("rechaza herramientas desconocidas y entradas inválidas sin tocar la base", async () => {
    const ctx = { supabase: null as never, userId: "u", conversationId: "c", timeZone: "America/Mexico_City" };
    expect((await runTool("enviar_correo", {}, ctx)).isError).toBe(true);
    expect((await runTool("consultar_agenda", { desde: "2026-11-10", hasta: "2026-11-01" }, ctx)).isError).toBe(true);
    expect((await runTool("proponer_completar_tarea", { tarea_id: "no-es-uuid" }, ctx)).isError).toBe(true);
  });
});
