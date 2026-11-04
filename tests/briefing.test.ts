import { describe, expect, it } from "vitest";
import type { Meeting } from "@/lib/meetings/model";
import type { Task } from "@/lib/tasks/model";
import { briefingKindAt, briefingScript, buildAlerts, buildBriefing, reminderUrl } from "@/lib/briefing";

const TZ = "America/Mexico_City"; // UTC-6
const NOW = new Date("2026-11-04T15:00:00Z"); // 09:00 local, miércoles

function meeting(id: string, start: string, end: string, extra: Partial<Meeting> = {}): Meeting {
  return {
    id,
    title: id,
    description: null,
    location: null,
    starts_at: start,
    ends_at: end,
    status: "scheduled",
    source: "manual",
    project_id: null,
    client_id: null,
    created_at: start,
    ...extra,
  };
}

function task(id: string, due: string | null, extra: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: null,
    status: "pending",
    priority: 3,
    is_urgent: false,
    is_important: false,
    due_at: due,
    due_all_day: false,
    completed_at: null,
    completion_confirmed: false,
    project_id: null,
    client_id: null,
    source: "manual",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

describe("resumen de la mañana", () => {
  const tasks = [
    task("vencida", "2026-11-02T18:00:00Z"),
    task("hoy-normal", "2026-11-04T22:00:00Z"),
    task("hoy-urgente", "2026-11-04T20:00:00Z", { is_urgent: true, is_important: true }),
    task("mañana", "2026-11-05T18:00:00Z"),
    task("sin-fecha-importante", null, { is_important: true }),
    task("terminada-hoy", "2026-11-04T17:00:00Z", { status: "done", completed_at: "2026-11-04T16:00:00Z" }),
  ];
  const meetings = [
    meeting("junta", "2026-11-04T16:00:00Z", "2026-11-04T17:00:00Z", {
      participants: [{ id: "p", display_name: "Ana", contact: null }],
    }),
    meeting("cancelada", "2026-11-04T18:00:00Z", "2026-11-04T19:00:00Z", { status: "cancelled" }),
    meeting("mañana-1", "2026-11-05T16:00:00Z", "2026-11-05T17:00:00Z"),
  ];
  const b = buildBriefing("morning", NOW, tasks, meetings, { timeZone: TZ });

  it("cuenta reuniones activas, tareas de hoy y vencidas", () => {
    expect(b.meetings.map((m) => m.id)).toEqual(["junta"]);
    expect(b.meetingMinutes).toBe(60);
    expect(b.dueToday.map((t) => t.id)).toEqual(["hoy-urgente", "hoy-normal"]);
    expect(b.overdue.map((t) => t.id)).toEqual(["vencida"]);
    expect(b.headline).toBe("Hoy: 1 reunión, 2 tareas para hoy, 1 vencida.");
  });

  it("prioriza urgente e importante primero", () => {
    expect(b.priorities[0].id).toBe("hoy-urgente");
    expect(b.priorities).toHaveLength(3);
  });

  it("incluye tiempo libre, terminadas y lo de mañana", () => {
    expect(b.free[0]).toEqual({ start: "09:00", end: "10:00", minutes: 60 });
    expect(b.completed.map((t) => t.id)).toEqual(["terminada-hoy"]);
    expect(b.tomorrowMeetings.map((m) => m.id)).toEqual(["mañana-1"]);
    expect(b.tomorrowTasks.map((t) => t.id)).toEqual(["mañana"]);
    expect(b.alerts[0]).toMatch(/1 tarea vencida/);
  });

  it("el guion menciona reuniones y prioridades sin abreviaturas de hora", () => {
    const text = briefingScript(b, "Dina", TZ).join(" ");
    expect(text).toMatch(/^Buenos días, Dina/);
    expect(text).toMatch(/junta, con Ana/);
    expect(text).toMatch(/Primero, hoy-urgente, urgente e importante/);
    expect(text).not.toMatch(/a\.\s?m\.|p\.\s?m\./);
  });
});

describe("cierre del día", () => {
  it("resume lo terminado y lo pendiente", () => {
    const b = buildBriefing(
      "closing",
      new Date("2026-11-04T23:30:00Z"),
      [
        task("pendiente", "2026-11-05T05:59:00Z", { due_all_day: true }),
        task("hecha", null, { status: "done", completed_at: "2026-11-04T20:00:00Z" }),
      ],
      [],
      { timeZone: TZ },
    );
    expect(b.headline).toBe("Terminaste 1 tarea; queda 1 pendiente de hoy.");
    const text = briefingScript(b, null, TZ).join(" ");
    expect(text).toMatch(/Terminaste: hecha/);
    expect(text).toMatch(/Quedaron pendientes de hoy: pendiente/);
  });

  it("elige mañana o cierre según la hora de cierre", () => {
    expect(briefingKindAt(new Date("2026-11-04T22:44:00Z"), "16:45", TZ)).toBe("morning");
    expect(briefingKindAt(new Date("2026-11-04T22:45:00Z"), "16:45:00", TZ)).toBe("closing");
  });
});

describe("alertas", () => {
  it("recordatorios vencidos, reuniones próximas y tareas vencidas, sin duplicados", () => {
    const alerts = buildAlerts(
      NOW,
      [task("vencida", "2026-11-03T18:00:00Z"), task("futura", "2026-11-06T18:00:00Z")],
      [
        meeting("ya-casi", "2026-11-04T15:10:00Z", "2026-11-04T16:00:00Z"),
        meeting("lejos", "2026-11-04T18:00:00Z", "2026-11-04T19:00:00Z"),
      ],
      [
        { id: "r1", title: "Llamar", remind_at: "2026-11-04T14:55:00Z", task_id: "t1", meeting_id: null },
        { id: "r2", title: "Futuro", remind_at: "2026-11-04T16:00:00Z", task_id: null, meeting_id: null },
      ],
      TZ,
    );
    expect(alerts.map((a) => a.key)).toEqual([
      "meeting:ya-casi:2026-11-04T15:10:00Z",
      "reminder:r1",
      "overdue:vencida",
    ]);
    expect(alerts[0].body).toBe("Empieza en 10 min");
    expect(alerts[1].url).toBe("/tareas/t1");
  });

  it("enlace del recordatorio según su destino", () => {
    expect(reminderUrl({ task_id: null, meeting_id: "m" })).toBe("/agenda/m");
    expect(reminderUrl({ task_id: null, meeting_id: null })).toBe("/agenda");
  });
});
