import { describe, expect, it } from "vitest";
import { describeDevice, generateDeviceToken, hashDeviceToken, isValidDeviceToken } from "@/lib/device";

describe("tokens de dispositivo", () => {
  it("genera tokens aleatorios de 256 bits en base64url", () => {
    const a = generateDeviceToken();
    const b = generateDeviceToken();
    expect(isValidDeviceToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("rechaza tokens mal formados", () => {
    expect(isValidDeviceToken(undefined)).toBe(false);
    expect(isValidDeviceToken("corto")).toBe(false);
    expect(isValidDeviceToken("a".repeat(42) + "!")).toBe(false);
  });

  it("produce un hash SHA-256 hexadecimal estable (formato que exige la BD)", async () => {
    const h = await hashDeviceToken("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("describeDevice", () => {
  it("distingue celular y tablet Android", () => {
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36").name).toBe(
      "Celular Android",
    );
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36").name).toBe("Tablet Android");
  });
  it("maneja User-Agent vacío", () => {
    expect(describeDevice(null)).toEqual({ name: "Dispositivo", platform: null });
  });
});
