import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicEnv, isEmailAllowed, publicEnvIssues } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("variables de entorno", () => {
  it("devuelve null si Supabase no está configurado", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getPublicEnv()).toBeNull();
  });

  it("valida la configuración pública", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "x".repeat(40));
    expect(getPublicEnv()?.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
  });

  it("solo permite correos de la lista (sin distinguir mayúsculas)", () => {
    vi.stubEnv("ALLOWED_EMAILS", "Persona@Example.com, otra@example.com");
    expect(isEmailAllowed("persona@example.com")).toBe(true);
    expect(isEmailAllowed("intruso@example.com")).toBe(false);
  });

  it("niega todo si la lista está vacía", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");
    expect(isEmailAllowed("persona@example.com")).toBe(false);
  });
});

describe("clave publishable de Supabase", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("acepta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_ejemploFicticio1234567890");
    expect(getPublicEnv()?.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("sb_publishable_ejemploFicticio1234567890");
  });
});

describe("diagnóstico de configuración", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("tolera espacios y comillas al pegar valores", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", '  "https://demo.supabase.co" ');
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", " sb_publishable_ejemploFicticio1234567890 ");
    expect(getPublicEnv()?.NEXT_PUBLIC_SUPABASE_URL).toBe("https://demo.supabase.co");
  });
  it("reporta el nombre de la variable inválida", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL = https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_ejemploFicticio1234567890");
    expect(publicEnvIssues()).toEqual(["NEXT_PUBLIC_SUPABASE_URL"]);
  });
});
