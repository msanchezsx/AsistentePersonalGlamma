import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "@/lib/login-errors";

describe("errores al pedir el enlace", () => {
  it("explica el límite de correos por hora", () => {
    expect(loginErrorMessage({ status: 429, code: "over_email_send_rate_limit" })).toMatch(/límite de correos/);
  });
  it("explica la espera entre solicitudes", () => {
    expect(loginErrorMessage({ status: 429, code: "over_request_rate_limit" })).toMatch(/Espera un minuto/);
  });
  it("no revela si el correo existe", () => {
    expect(loginErrorMessage({ status: 422, code: "otp_disabled" })).toBeNull();
    expect(loginErrorMessage({ status: 400 })).toBeNull();
  });
  it("otros errores", () => {
    expect(loginErrorMessage({ status: 500 })).toMatch(/No se pudo enviar/);
  });
});
