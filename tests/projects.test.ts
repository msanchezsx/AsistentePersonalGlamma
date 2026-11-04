import { describe, expect, it } from "vitest";
import {
  clientSchema,
  contactSchema,
  dueLabel,
  followUpDueAt,
  followUpSchema,
  groupFollowUps,
  projectSchema,
  type FollowUp,
} from "@/lib/projects";

const TZ = "America/Mexico_City";
const NOW = new Date("2026-11-04T18:00:00Z"); // 12:00 local

function fu(id: string, extra: Partial<FollowUp> = {}): FollowUp {
  return {
    id,
    kind: "follow_up",
    owner_side: "mine",
    title: id,
    description: null,
    status: "open",
    due_at: null,
    closed_at: null,
    created_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

describe("proyectos y clientes", () => {
  it("valida proyecto con pedido y fechas", () => {
    const base = { name: "Cajas Cliente Demo", code: "103050", description: "", client_id: "", status: "active", start_date: "2026-11-01", due_date: "2026-11-20" };
    const ok = projectSchema.safeParse(base);
    expect(ok.success && ok.data.client_id).toBeNull();
    expect(projectSchema.safeParse({ ...base, due_date: "2026-10-01" }).success).toBe(false);
    expect(projectSchema.safeParse({ ...base, name: " " }).success).toBe(false);
  });

  it("valida cliente y contacto", () => {
    expect(clientSchema.safeParse({ name: "Cliente Demo", code: "", notes: "", status: "active" }).success).toBe(true);
    const c = { full_name: "Ana Pérez", role: "", relationship: "client", email: "ana@example.com", phone: "" };
    expect(contactSchema.safeParse(c).success).toBe(true);
    expect(contactSchema.safeParse({ ...c, email: "ana@" }).success).toBe(false);
  });
});

describe("seguimientos", () => {
  it("acepta persona nueva o existente", () => {
    const r = followUpSchema.safeParse({
      title: "Ana manda la orden de compra",
      owner_side: "theirs",
      kind: "commitment",
      due_date: "2026-11-06",
      contact_id: "",
      new_contact: "Ana",
      client_id: "",
      project_id: "",
    });
    expect(r.success && r.data.new_contact).toBe("Ana");
  });

  it("fecha compromiso al final del día local", () => {
    expect(followUpDueAt("2026-11-06", TZ)).toBe("2026-11-07T05:59:59.000Z");
    expect(followUpDueAt(null, TZ)).toBeNull();
  });

  it("agrupa yo debo / me deben con vencidos primero", () => {
    const g = groupFollowUps(
      [
        fu("sin-fecha"),
        fu("futuro", { due_at: "2026-11-10T05:59:59Z" }),
        fu("vencido", { due_at: "2026-11-02T05:59:59Z" }),
        fu("de-ellos", { owner_side: "theirs" }),
        fu("hecho", { status: "done", closed_at: "2026-11-03T00:00:00Z" }),
      ],
      NOW,
    );
    expect(g.mine.map((f) => f.id)).toEqual(["vencido", "futuro", "sin-fecha"]);
    expect(g.theirs.map((f) => f.id)).toEqual(["de-ellos"]);
    expect(g.overdue).toBe(1);
    expect(g.closed.map((f) => f.id)).toEqual(["hecho"]);
  });

  it("etiqueta de fecha", () => {
    expect(dueLabel("2026-11-05T05:59:59Z", NOW, TZ)).toBe("Hoy");
    expect(dueLabel("2026-11-02T05:59:59Z", NOW, TZ)).toMatch(/^Venció/);
    expect(dueLabel(null, NOW, TZ)).toBeNull();
  });
});
