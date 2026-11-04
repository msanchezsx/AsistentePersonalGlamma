import { describe, expect, it } from "vitest";
import { planPushes, secretMatches } from "@/lib/push-plan";
import type { CriticalItem } from "@/lib/briefing";

const NOW = new Date("2026-11-04T15:00:00Z");

describe("envío programado de avisos", () => {
  const crit: CriticalItem = {
    key: "task:t1:2026-11-04T14:58:00.000Z",
    kind: "task",
    id: "t1",
    title: "Entregar cotización",
    detail: "Tarea crítica: vence a las 09:00 a.m.",
    showAt: "2026-11-04T14:58:00.000Z",
    url: "/tareas/t1",
    reminderId: "r1",
  };

  it("envía críticos y recordatorios dentro de la ventana, sin duplicar el recordatorio del crítico", () => {
    const plan = planPushes(
      NOW,
      [
        { id: "r1", title: "x", remind_at: "2026-11-04T14:58:00Z", task_id: "t1", meeting_id: null },
        { id: "r2", title: "Llamar a Ana", remind_at: "2026-11-04T14:55:00Z", task_id: null, meeting_id: "m1" },
        { id: "r3", title: "Viejo", remind_at: "2026-11-04T13:00:00Z", task_id: null, meeting_id: null },
        { id: "r4", title: "Futuro", remind_at: "2026-11-04T15:10:00Z", task_id: null, meeting_id: null },
      ],
      [crit, { ...crit, key: "x", showAt: "2026-11-04T16:00:00.000Z" }],
    );
    expect(plan.map((p) => [p.kind, p.reminderId, p.critical, p.url])).toEqual([
      ["alert", "r1", true, "/tareas/t1"],
      ["reminder", "r2", false, "/agenda/m1"],
    ]);
    expect(plan[0].title).toBe("⚠ Entregar cotización");
    expect(plan[1].dedupeKey).toBe("push:reminder:r2:2026-11-04T14:55:00Z");
  });

  it("compara el secreto completo", () => {
    expect(secretMatches("abc123", "abc123")).toBe(true);
    expect(secretMatches("abc124", "abc123")).toBe(false);
    expect(secretMatches("abc", "abc123")).toBe(false);
    expect(secretMatches(null, "abc")).toBe(false);
    expect(secretMatches("abc", "")).toBe(false);
  });
});
