import { describe, expect, it } from "vitest";
import {
  buildRrule,
  describeRrule,
  isoWeekday,
  occurrencesAfter,
  parseRepeatInput,
  REPEAT_OPTIONS,
  repeatOptionOf,
  startMatchesRule,
} from "@/lib/recurrence";

// Misma expresión que el CHECK de recurrence_rules.rrule en la base de datos.
const DB_RRULE = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/;

function fd(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("buildRrule", () => {
  // 2026-11-03 es martes.
  it("genera reglas válidas para la base de datos", () => {
    for (const o of REPEAT_OPTIONS) {
      const r = buildRrule(o.value, "2026-11-03");
      if (o.value === "") expect(r).toBeNull();
      else expect(r).toMatch(DB_RRULE);
    }
  });
  it("usa el día de la semana y del mes de la fecha inicial", () => {
    expect(isoWeekday("2026-11-03")).toBe(1);
    expect(buildRrule("weekly", "2026-11-03")).toBe("FREQ=WEEKLY;BYDAY=TU");
    expect(buildRrule("biweekly", "2026-11-09")).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO");
    expect(buildRrule("monthly", "2026-11-03")).toBe("FREQ=MONTHLY;BYMONTHDAY=3");
  });
  it("repeatOptionOf es el inverso", () => {
    for (const o of REPEAT_OPTIONS) {
      expect(repeatOptionOf(buildRrule(o.value, "2026-11-03"))).toBe(o.value);
    }
  });
});

describe("occurrencesAfter", () => {
  it("diario", () => {
    expect(occurrencesAfter("FREQ=DAILY", "2026-11-03", "2026-11-03", { limit: 3 })).toEqual([
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
  });
  it("de lunes a viernes salta el fin de semana", () => {
    // viernes 6 → lunes 9
    expect(occurrencesAfter("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR", "2026-11-03", "2026-11-06", { limit: 2 })).toEqual([
      "2026-11-09",
      "2026-11-10",
    ]);
  });
  it("semanal", () => {
    expect(occurrencesAfter("FREQ=WEEKLY;BYDAY=TU", "2026-11-03", "2026-11-03", { limit: 3 })).toEqual([
      "2026-11-10",
      "2026-11-17",
      "2026-11-24",
    ]);
  });
  it("cada 2 semanas respeta la semana de inicio aunque se calcule desde otra fecha", () => {
    const r = "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO";
    expect(occurrencesAfter(r, "2026-11-09", "2026-11-09", { limit: 2 })).toEqual(["2026-11-23", "2026-12-07"]);
    // desde una fecha intermedia (semana impar) no cambia el ritmo
    expect(occurrencesAfter(r, "2026-11-09", "2026-11-17", { limit: 1 })).toEqual(["2026-11-23"]);
  });
  it("mensual el día 31 omite los meses sin ese día", () => {
    expect(occurrencesAfter("FREQ=MONTHLY;BYMONTHDAY=31", "2027-01-31", "2027-01-31", { limit: 3 })).toEqual([
      "2027-03-31",
      "2027-05-31",
      "2027-07-31",
    ]);
  });
  it("respeta la fecha final (inclusiva) y el horizonte", () => {
    expect(occurrencesAfter("FREQ=DAILY", "2026-11-03", "2026-11-03", { untilKey: "2026-11-05" })).toEqual([
      "2026-11-04",
      "2026-11-05",
    ]);
    expect(occurrencesAfter("FREQ=WEEKLY;BYDAY=TU", "2026-11-03", "2026-11-02", { horizonKey: "2026-11-17" })).toEqual(
      ["2026-11-03", "2026-11-10", "2026-11-17"],
    );
    expect(occurrencesAfter("FREQ=DAILY", "2026-11-03", "2026-11-10", { untilKey: "2026-11-10" })).toEqual([]);
  });
  it("cruza el fin de año", () => {
    expect(occurrencesAfter("FREQ=MONTHLY;BYMONTHDAY=15", "2026-11-15", "2026-11-15", { limit: 2 })).toEqual([
      "2026-12-15",
      "2027-01-15",
    ]);
  });
});

describe("describeRrule / startMatchesRule", () => {
  it("describe en español", () => {
    expect(describeRrule(null)).toBe("No se repite");
    expect(describeRrule("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR")).toBe("De lunes a viernes");
    expect(describeRrule("FREQ=WEEKLY;BYDAY=MO")).toBe("Cada lunes");
    expect(describeRrule("FREQ=WEEKLY;INTERVAL=2;BYDAY=FR")).toBe("Cada 2 semanas, el viernes");
    expect(describeRrule("FREQ=MONTHLY;BYMONTHDAY=3", "2026-12-31")).toBe("Cada mes, el día 3 hasta el 31 de diciembre de 2026");
  });
  it("detecta inicio en fin de semana para lunes a viernes", () => {
    expect(startMatchesRule("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR", "2026-11-07")).toBe(false);
    expect(startMatchesRule("FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR", "2026-11-09")).toBe(true);
  });
});

describe("parseRepeatInput", () => {
  it("sin repetición", () => {
    expect(parseRepeatInput(fd({ repeat: "" }), null)).toEqual({ ok: true, value: { option: "", untilKey: null } });
  });
  it("exige fecha para repetir", () => {
    const r = parseRepeatInput(fd({ repeat: "daily" }), null);
    expect(r.ok).toBe(false);
  });
  it("valida la fecha final", () => {
    expect(parseRepeatInput(fd({ repeat: "daily", repeat_until: "2026-11-01" }), "2026-11-03").ok).toBe(false);
    expect(parseRepeatInput(fd({ repeat: "weekly", repeat_until: "2026-12-01" }), "2026-11-03")).toEqual({
      ok: true,
      value: { option: "weekly", untilKey: "2026-12-01" },
    });
  });
  it("rechaza opciones desconocidas", () => {
    expect(parseRepeatInput(fd({ repeat: "hourly" }), "2026-11-03").ok).toBe(false);
  });
});
