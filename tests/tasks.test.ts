import { describe, expect, it } from "vitest";
import { addDaysKey, localDateKey, localTimeKey, zonedToUtc } from "@/lib/zoned-time";
import { groupTasks, isOverdue, parseTaskForm, toDueFields, type Task } from "@/lib/tasks/model";
import { dueFormDefaults, formatDue } from "@/lib/tasks/format";

const TZ = "America/Mexico_City";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

function task(over: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    title: "Tarea de prueba",
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
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...over,
  };
}

describe("hora local ↔ UTC", () => {
  it("4:00 p.m. en Ciudad de México es 22:00 UTC", () => {
    expect(zonedToUtc("2026-11-03", "16:00", TZ).toISOString()).toBe("2026-11-03T22:00:00.000Z");
  });
  it("respeta el horario de verano de otras zonas", () => {
    expect(zonedToUtc("2026-07-01", "09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "09:00", "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
  });
  it("obtiene fecha y hora locales", () => {
    const d = new Date("2026-11-04T03:30:00Z"); // 3 nov 21:30 en CDMX
    expect(localDateKey(d, TZ)).toBe("2026-11-03");
    expect(localTimeKey(d, TZ)).toBe("21:30");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("formulario de tarea", () => {
  it("valida y normaliza", () => {
    const r = parseTaskForm(
      form({
        title: "  Llamar a cliente  ",
        description: "",
        priority: "2",
        is_urgent: "on",
        due_date: "2026-11-04",
        due_time: "",
      }),
    );
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.title).toBe("Llamar a cliente");
    expect(r.data.description).toBeNull();
    expect(r.data.is_urgent).toBe(true);
    expect(r.data.is_important).toBe(false);
    expect(r.data.project_id).toBeNull();
  });
  it("exige título", () => {
    const r = parseTaskForm(form({ title: "   ", priority: "3" }));
    expect(r.success).toBe(false);
  });
  it("rechaza hora sin fecha y ids inválidos", () => {
    expect(parseTaskForm(form({ title: "x", priority: "3", due_time: "10:00" })).success).toBe(false);
    expect(parseTaskForm(form({ title: "x", priority: "3", project_id: "no-es-uuid" })).success).toBe(false);
  });
  it("rechaza prioridad fuera de rango", () => {
    expect(parseTaskForm(form({ title: "x", priority: "9" })).success).toBe(false);
  });
});

describe("fecha límite", () => {
  it("sin hora = todo el día (fin del día local)", () => {
    expect(toDueFields({ due_date: "2026-11-04", due_time: null }, TZ)).toEqual({
      due_at: "2026-11-05T05:59:59.000Z",
      due_all_day: true,
    });
  });
  it("con hora", () => {
    expect(toDueFields({ due_date: "2026-11-04", due_time: "16:00" }, TZ)).toEqual({
      due_at: "2026-11-04T22:00:00.000Z",
      due_all_day: false,
    });
  });
  it("sin fecha", () => {
    expect(toDueFields({ due_date: null, due_time: null }, TZ)).toEqual({ due_at: null, due_all_day: false });
  });
  it("precarga el formulario igual que se guardó", () => {
    expect(dueFormDefaults({ due_at: "2026-11-04T22:00:00.000Z", due_all_day: false }, TZ)).toEqual({
      due_date: "2026-11-04",
      due_time: "16:00",
    });
    expect(dueFormDefaults({ due_at: "2026-11-05T05:59:59.000Z", due_all_day: true }, TZ)).toEqual({
      due_date: "2026-11-04",
      due_time: "",
    });
  });
});

describe("agrupación de tareas", () => {
  const now = new Date("2026-11-03T18:00:00Z"); // mar 3 nov, 12:00 CDMX

  it("clasifica en vencidas, hoy, mañana, próximas, sin fecha y cerradas", () => {
    const tasks = [
      task({ title: "vencida", due_at: "2026-11-03T15:00:00Z" }),
      task({ title: "hoy", due_at: "2026-11-03T22:00:00Z" }),
      task({ title: "hoy todo el día", due_at: "2026-11-04T05:59:59Z", due_all_day: true }),
      task({ title: "mañana", due_at: "2026-11-04T16:00:00Z" }),
      task({ title: "próxima", due_at: "2026-11-10T16:00:00Z" }),
      task({ title: "sin fecha" }),
      task({ title: "hecha", status: "done", completed_at: "2026-11-03T17:00:00Z", due_at: "2026-11-01T00:00:00Z" }),
    ];
    const g = groupTasks(tasks, now, TZ);
    expect(g.overdue.map((t) => t.title)).toEqual(["vencida"]);
    expect(g.today.map((t) => t.title).sort()).toEqual(["hoy", "hoy todo el día"]);
    expect(g.tomorrow.map((t) => t.title)).toEqual(["mañana"]);
    expect(g.upcoming.map((t) => t.title)).toEqual(["próxima"]);
    expect(g.noDate.map((t) => t.title)).toEqual(["sin fecha"]);
    expect(g.closed.map((t) => t.title)).toEqual(["hecha"]);
  });

  it("una tarea terminada nunca está vencida", () => {
    expect(isOverdue(task({ status: "done", due_at: "2026-01-01T00:00:00Z" }), now)).toBe(false);
  });

  it("ordena urgente+importante primero", () => {
    const g = groupTasks(
      [
        task({ title: "normal", due_at: "2026-11-03T20:00:00Z" }),
        task({ title: "crítica", is_urgent: true, is_important: true, due_at: "2026-11-03T23:00:00Z" }),
      ],
      now,
      TZ,
    );
    expect(g.today[0].title).toBe("crítica");
  });
});

describe("formato de fecha límite", () => {
  const now = new Date("2026-11-03T18:00:00Z");
  it("usa hoy / mañana / ayer", () => {
    expect(formatDue({ due_at: "2026-11-03T22:00:00Z", due_all_day: false }, now, TZ)).toMatch(/^Hoy 4:00/);
    expect(formatDue({ due_at: "2026-11-05T05:59:59Z", due_all_day: true }, now, TZ)).toBe("Mañana");
    expect(formatDue({ due_at: "2026-11-02T15:00:00Z", due_all_day: false }, now, TZ)).toMatch(/^Ayer 9:00/);
  });
});
