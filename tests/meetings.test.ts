import { describe, expect, it } from "vitest";
import {
  groupMeetingsByDay,
  parseMeetingForm,
  participantNames,
  toMeetingTimes,
  type Meeting,
} from "@/lib/meetings/model";
import { minutesBefore, parseReminderMinutes, reminderAt } from "@/lib/reminders";

const TZ = "America/Mexico_City";

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const base = { title: "Revisión pedido 103050", date: "2026-11-03", start_time: "16:00" };

describe("formulario de reunión", () => {
  it("valida y separa participantes sin duplicados", () => {
    const r = parseMeetingForm(form({ ...base, participants: "Mi jefe, Ana López; mi jefe, Ana López\nLuis" }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.participants).toEqual(["Mi jefe", "Ana López", "mi jefe", "Luis"]);
    expect(r.data.end_time).toBeNull();
  });
  it("exige fecha y hora de inicio", () => {
    expect(parseMeetingForm(form({ title: "x", date: "", start_time: "16:00" })).success).toBe(false);
    expect(parseMeetingForm(form({ title: "x", date: "2026-11-03", start_time: "" })).success).toBe(false);
  });
  it("rechaza fin antes del inicio", () => {
    const r = parseMeetingForm(form({ ...base, end_time: "15:00" }));
    expect(r.success).toBe(false);
  });
});

describe("horario de la reunión", () => {
  it("convierte a UTC y dura 1 hora por defecto", () => {
    expect(toMeetingTimes({ date: "2026-11-03", start_time: "16:00", end_time: null }, TZ)).toEqual({
      starts_at: "2026-11-03T22:00:00.000Z",
      ends_at: "2026-11-03T23:00:00.000Z",
    });
  });
  it("usa la hora de fin indicada", () => {
    expect(toMeetingTimes({ date: "2026-11-03", start_time: "16:00", end_time: "16:30" }, TZ).ends_at).toBe(
      "2026-11-03T22:30:00.000Z",
    );
  });
});

describe("agrupación por día", () => {
  const m = (title: string, starts_at: string): Meeting => ({
    id: title,
    title,
    description: null,
    location: null,
    starts_at,
    ends_at: starts_at,
    status: "scheduled",
    source: "manual",
    project_id: null,
    client_id: null,
    created_at: starts_at,
  });
  it("agrupa por fecha local y ordena por hora", () => {
    const days = groupMeetingsByDay(
      [m("b", "2026-11-03T22:00:00Z"), m("a", "2026-11-03T15:00:00Z"), m("c", "2026-11-04T03:00:00Z")],
      TZ,
    );
    // 2026-11-04T03:00Z es el 3 de noviembre a las 21:00 en CDMX
    expect(days).toHaveLength(1);
    expect(days[0].items.map((x) => x.title)).toEqual(["a", "b", "c"]);
  });
  it("nombres de participantes: contacto o nombre escrito", () => {
    expect(
      participantNames({
        participants: [
          { id: "1", display_name: "Mi jefe", contact: null },
          { id: "2", display_name: null, contact: { full_name: "Ana López" } },
        ],
      }),
    ).toEqual(["Mi jefe", "Ana López"]);
  });
});

describe("recordatorios", () => {
  it("solo acepta opciones conocidas", () => {
    expect(parseReminderMinutes("15")).toBe(15);
    expect(parseReminderMinutes("")).toBeNull();
    expect(parseReminderMinutes("7")).toBeNull();
    expect(parseReminderMinutes(null)).toBeNull();
  });
  it("calcula la hora del aviso y la recupera", () => {
    const at = reminderAt("2026-11-03T22:00:00.000Z", 15);
    expect(at).toBe("2026-11-03T21:45:00.000Z");
    expect(minutesBefore("2026-11-03T22:00:00.000Z", at)).toBe("15");
    expect(minutesBefore("2026-11-03T22:00:00.000Z", null)).toBe("");
  });
});
