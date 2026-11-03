import { describe, expect, it } from "vitest";
import { isEditing, readVersion } from "@/lib/concurrency";

function fd(v?: string) {
  const f = new FormData();
  if (v !== undefined) f.set("version", v);
  return f;
}

describe("control de cambios simultáneos", () => {
  it("lee la versión del formulario", () => {
    expect(readVersion(fd("2026-11-03T22:00:00.123456+00:00"))).toBe("2026-11-03T22:00:00.123456+00:00");
    expect(readVersion(fd())).toBeNull();
    expect(readVersion(fd("no es fecha"))).toBeNull();
    expect(readVersion(fd(""))).toBeNull();
  });
});

describe("actualización automática", () => {
  it("no refresca pantallas con formularios", () => {
    expect(isEditing("/tareas/nueva")).toBe(true);
    expect(isEditing("/agenda/nueva")).toBe(true);
    expect(isEditing("/capturar")).toBe(true);
    expect(isEditing("/tareas/2f1c2a7e-1111-4222-8333-944455556666")).toBe(true);
    expect(isEditing("/")).toBe(false);
    expect(isEditing("/agenda")).toBe(false);
    expect(isEditing("/tareas")).toBe(false);
  });
});
