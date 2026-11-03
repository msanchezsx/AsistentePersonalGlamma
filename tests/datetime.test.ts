import { describe, expect, it } from "vitest";
import { formatLongDate, greetingFor, isWorkingTime, localHour } from "@/lib/datetime";

const TZ = "America/Mexico_City"; // UTC-6 sin horario de verano desde 2022

describe("fechas en zona horaria de Ciudad de México", () => {
  it("convierte la hora UTC a la hora local", () => {
    expect(localHour(new Date("2026-11-03T15:00:00Z"), TZ)).toBe(9);
  });

  it("saluda según la hora local", () => {
    expect(greetingFor(new Date("2026-11-03T14:00:00Z"), TZ)).toBe("Buenos días"); // 8:00
    expect(greetingFor(new Date("2026-11-03T20:00:00Z"), TZ)).toBe("Buenas tardes"); // 14:00
    expect(greetingFor(new Date("2026-11-04T03:00:00Z"), TZ)).toBe("Buenas noches"); // 21:00
  });

  it("formatea la fecha larga en español", () => {
    expect(formatLongDate(new Date("2026-11-03T18:00:00Z"), TZ)).toBe("Martes, 3 de noviembre de 2026");
  });

  it("detecta la jornada laboral lunes a viernes de 9:00 a 17:00", () => {
    expect(isWorkingTime(new Date("2026-11-03T15:00:00Z"), { timeZone: TZ })).toBe(true); // mar 9:00
    expect(isWorkingTime(new Date("2026-11-03T23:00:00Z"), { timeZone: TZ })).toBe(false); // mar 17:00
    expect(isWorkingTime(new Date("2026-11-07T17:00:00Z"), { timeZone: TZ })).toBe(false); // sáb 11:00
  });
});
