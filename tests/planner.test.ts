import { describe, expect, it } from "vitest";
import type { Meeting } from "@/lib/meetings/model";
import type { Task } from "@/lib/tasks/model";
import {
  buildDayPlan,
  buildWeekPlan,
  formatClock,
  formatMinutes,
  freeSlots,
  parseAgendaParams,
  utcRangeForDays,
  weekRangeLabel,
  weekStartKey,
} from "@/lib/planner";

const TZ = "America/Mexico_City"; // UTC-6 (sin horario de verano)

function meeting(id: string, start: string, end: string, status: Meeting["status"] = "scheduled"): Meeting {
  return {
    id,
    title: id,
    description: null,
    location: null,
    starts_at: start,
    ends_at: end,
    status,
    source: "manual",
    project_id: null,
    client_id: null,
    created_at: start,
  };
}

function task(id: string, due: string | null, allDay = false, status: Task["status"] = "pending"): Task {
  return {
    id,
    title: id,
    description: null,
    status,
    priority: 3,
    is_urgent: false,
    is_important: false,
    due_at: due,
    due_all_day: allDay,
    completed_at: null,
    completion_confirmed: false,
    project_id: null,
    client_id: null,
    source: "manual",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
  };
}

describe("parámetros de la agenda", () => {
  it("valida vista y fecha", () => {
    expect(parseAgendaParams({}, "2026-11-03")).toEqual({ view: "lista", dateKey: "2026-11-03" });
    expect(parseAgendaParams({ vista: "dia", fecha: "2026-11-10" }, "2026-11-03")).toEqual({
      view: "dia",
      dateKey: "2026-11-10",
    });
    expect(parseAgendaParams({ vista: "semana", fecha: "2026-02-30" }, "2026-11-03").dateKey).toBe("2026-11-03");
    expect(parseAgendaParams({ vista: "x", fecha: "hola" }, "2026-11-03")).toEqual({
      view: "lista",
      dateKey: "2026-11-03",
    });
  });
  it("lunes de la semana", () => {
    expect(weekStartKey("2026-11-03")).toBe("2026-11-02"); // martes → lunes
    expect(weekStartKey("2026-11-08")).toBe("2026-11-02"); // domingo → lunes anterior
    expect(weekStartKey("2026-11-09")).toBe("2026-11-09");
    expect(weekStartKey("2027-01-01")).toBe("2026-12-28");
  });
  it("rango UTC de días locales", () => {
    expect(utcRangeForDays("2026-11-03", 1, TZ)).toEqual({
      from: "2026-11-03T06:00:00.000Z",
      to: "2026-11-04T06:00:00.000Z",
    });
  });
});

describe("plan del día", () => {
  const meetings = [
    meeting("junta", "2026-11-03T16:00:00Z", "2026-11-03T17:30:00Z"), // 10:00–11:30
    meeting("cancelada", "2026-11-03T18:00:00Z", "2026-11-03T19:00:00Z", "cancelled"),
    meeting("noche", "2026-11-04T03:00:00Z", "2026-11-04T04:00:00Z"), // 21:00 local del día 3
    meeting("otro-dia", "2026-11-04T16:00:00Z", "2026-11-04T17:00:00Z"),
  ];
  const tasks = [
    task("todo-el-dia", "2026-11-04T05:59:59Z", true),
    task("con-hora", "2026-11-03T15:00:00Z"), // 09:00
    task("misma-hora", "2026-11-03T16:00:00Z"), // 10:00, después de la reunión
    task("cancelada", "2026-11-03T20:00:00Z", false, "cancelled"),
  ];

  it("ordena reuniones y tareas, separa las de todo el día y omite canceladas", () => {
    const p = buildDayPlan("2026-11-03", meetings, tasks, TZ);
    expect(p.allDayTasks.map((t) => t.id)).toEqual(["todo-el-dia"]);
    expect(p.entries.map((e) => (e.kind === "meeting" ? e.meeting.id : e.task.id))).toEqual([
      "con-hora",
      "junta",
      "misma-hora",
      "noche",
    ]);
    expect(p.meetingMinutes).toBe(150);
  });

  it("la semana tiene 7 días de lunes a domingo", () => {
    const w = buildWeekPlan("2026-11-02", meetings, tasks, TZ);
    expect(w.map((d) => d.dateKey)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(w[2].entries.map((e) => (e.kind === "meeting" ? e.meeting.id : ""))).toEqual(["otro-dia"]);
  });
});

describe("tiempo libre", () => {
  it("calcula huecos de la jornada", () => {
    const ms = [
      meeting("a", "2026-11-03T16:00:00Z", "2026-11-03T17:30:00Z"), // 10:00–11:30
      meeting("b", "2026-11-03T17:00:00Z", "2026-11-03T18:00:00Z"), // 11:00–12:00 (se traslapa)
      meeting("c", "2026-11-03T18:10:00Z", "2026-11-03T20:00:00Z"), // 12:10–14:00
      meeting("x", "2026-11-03T20:00:00Z", "2026-11-03T21:00:00Z", "cancelled"),
    ];
    expect(freeSlots("2026-11-03", ms, { timeZone: TZ })).toEqual([
      { start: "09:00", end: "10:00", minutes: 60 },
      { start: "14:00", end: "17:00", minutes: 180 },
    ]);
  });
  it("reuniones fuera de la jornada no la ocupan; día vacío = jornada completa", () => {
    const ms = [meeting("temprano", "2026-11-03T13:00:00Z", "2026-11-03T14:00:00Z")]; // 7:00–8:00
    expect(freeSlots("2026-11-03", ms, { timeZone: TZ })).toEqual([{ start: "09:00", end: "17:00", minutes: 480 }]);
  });
  it("jornada llena", () => {
    const ms = [meeting("todo", "2026-11-03T14:00:00Z", "2026-11-04T00:00:00Z")];
    expect(freeSlots("2026-11-03", ms, { timeZone: TZ })).toEqual([]);
  });
});

describe("formatos", () => {
  it("minutos, horas y rango de semana", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 h");
    expect(formatMinutes(150)).toBe("2 h 30 min");
    expect(weekRangeLabel("2026-11-02")).toBe("2 – 8 de noviembre de 2026");
    expect(weekRangeLabel("2026-11-30")).toBe("30 de noviembre – 6 de diciembre de 2026");
    expect(weekRangeLabel("2026-12-28")).toBe("28 de diciembre de 2026 – 3 de enero de 2027");
    expect(formatClock("13:30")).toMatch(/01:30\s?p\.\s?m\./);
  });
});
