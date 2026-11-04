import { describe, expect, it } from "vitest";
import type { Meeting } from "@/lib/meetings/model";
import type { Task } from "@/lib/tasks/model";
import { buildMetrics, metricsStartKey } from "@/lib/metrics";

const TZ = "America/Mexico_City";
const NOW = new Date("2026-11-04T18:00:00Z"); // miércoles; semana del lunes 2

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: null,
    status: "pending",
    priority: 3,
    is_urgent: false,
    is_important: false,
    due_at: null,
    due_all_day: false,
    completed_at: null,
    completion_confirmed: false,
    project_id: null,
    client_id: null,
    source: "manual",
    created_at: "2026-11-03T15:00:00Z",
    updated_at: "2026-11-03T15:00:00Z",
    ...extra,
  };
}

function meeting(id: string, start: string, end: string): Meeting {
  return {
    id,
    title: id,
    description: null,
    location: null,
    starts_at: start,
    ends_at: end,
    status: "held",
    source: "manual",
    project_id: null,
    client_id: null,
    created_at: start,
  };
}

describe("indicadores", () => {
  it("semanas de lunes a domingo, de la más antigua a la actual", () => {
    const m = buildMetrics(NOW, [], [], { timeZone: TZ });
    expect(m.weeks.map((w) => w.weekKey)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(metricsStartKey(NOW, 4, TZ)).toBe("2026-10-12");
    expect(m.onTimeRate).toBeNull();
    expect(m.meetingShare).toBeNull();
  });

  it("cuenta terminadas, creadas, a tiempo y horas de reunión", () => {
    const tasks = [
      task("a", { status: "done", due_at: "2026-11-03T20:00:00Z", completed_at: "2026-11-03T19:00:00Z" }),
      task("b", { status: "done", due_at: "2026-10-28T20:00:00Z", completed_at: "2026-10-29T19:00:00Z", created_at: "2026-10-27T15:00:00Z" }),
      task("c", { status: "done", completed_at: "2026-10-20T19:00:00Z", created_at: "2026-10-20T15:00:00Z" }),
      task("vencida", { due_at: "2026-11-01T20:00:00Z", is_urgent: true, is_important: true }),
      task("semana", { due_at: "2026-11-06T20:00:00Z", is_important: true }),
      task("cancelada", { status: "cancelled" }),
    ];
    const meetings = [
      meeting("m1", "2026-10-27T16:00:00Z", "2026-10-27T17:30:00Z"),
      meeting("futura", "2026-11-05T16:00:00Z", "2026-11-05T17:00:00Z"),
    ];
    const m = buildMetrics(NOW, tasks, meetings, { timeZone: TZ });
    expect(m.weeks.map((w) => w.completed)).toEqual([0, 1, 1, 1]);
    expect(m.weeks.map((w) => w.created)).toEqual([0, 1, 1, 3]);
    expect(m.weeks[2].meetingHours).toBe(1.5);
    expect(m.weeks[3].meetingHours).toBe(0);
    expect(m.onTimeRate).toBe(50);
    expect(m.onTimeSample).toBe(2);
    expect(m.open).toBe(2);
    expect(m.overdue).toBe(1);
    expect(m.dueThisWeek).toBe(1);
    expect(m.quadrants).toEqual({ doNow: 1, schedule: 1, delegate: 0, drop: 0 });
    expect(m.meetingShare).toBe(1);
  });

  it("recomienda depurar vencidas y delegar con reglas explícitas", () => {
    const tasks = [
      ...["1", "2", "3"].map((id) => task(`v${id}`, { due_at: "2026-11-01T20:00:00Z", is_urgent: true })),
    ];
    const m = buildMetrics(NOW, tasks, [], { timeZone: TZ });
    expect(m.recommendations.join(" ")).toMatch(/3 tareas vencidas/);
    expect(m.recommendations.join(" ")).toMatch(/candidatas a delegar/);
  });
});

import { analysisGaps, lines, parseAnalysis } from "@/lib/incidents";

describe("análisis de problemas", () => {
  it("convierte renglones en lista sin viñetas", () => {
    expect(lines("- uno\n\n2. dos\n• tres  ")).toEqual(["uno", "dos", "tres"]);
  });

  it("arma el análisis desde el formulario", () => {
    const fd = new FormData();
    fd.set("facts", "Caja 103050 llegó húmeda");
    fd.set("why1", "Se almacenó en patio");
    fd.set("why3", "No hay espacio techado");
    fd.set("ish_materiales", "Cartón sin recubrimiento");
    fd.set("root_causes", "Falta de área techada");
    const a = parseAnalysis(fd);
    expect(a.five_whys.map((w) => w.answer)).toEqual(["Se almacenó en patio", "No hay espacio techado"]);
    expect(a.ishikawa.materiales).toEqual(["Cartón sin recubrimiento"]);
    expect(a.ishikawa.metodo).toEqual([]);
    expect(analysisGaps(a, [])).toEqual([
      "Completa al menos 3 porqués.",
      "Agrega una acción correctiva.",
      "Agrega una acción preventiva para que no se repita.",
    ]);
    expect(
      analysisGaps({ ...a, five_whys: [...a.five_whys, a.five_whys[0]] }, [
        { action_type: "corrective", status: "planned" },
        { action_type: "preventive", status: "done" },
      ]),
    ).toEqual([]);
  });
});
