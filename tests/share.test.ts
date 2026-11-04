import { describe, expect, it } from "vitest";
import { firstLine, readShared, sharedDescription, stripChatHeaders } from "@/lib/share";

describe("contenido compartido", () => {
  it("solo acepta enlaces http(s) y recorta textos largos", () => {
    const s = readShared({ text: "x".repeat(5000), url: "javascript:alert(1)" });
    expect(s.text).toHaveLength(4000);
    expect(s.url).toBe("");
    expect(readShared({ url: "https://glama.com.mx" }).url).toBe("https://glama.com.mx");
  });

  it("quita encabezados de WhatsApp y detecta al autor", () => {
    const r = stripChatHeaders("[4/11/26, 10:15] Ana Pérez: Necesito la cotización del pedido 103050 mañana\n[4/11/26, 10:16] Ana Pérez: gracias");
    expect(r.author).toBe("Ana Pérez");
    expect(r.body).toBe("Necesito la cotización del pedido 103050 mañana\ngracias");
    expect(stripChatHeaders("4/11/26, 10:15 p. m. - Luis: hola").body).toBe("hola");
    expect(stripChatHeaders("Mensaje normal: sin encabezado").author).toBeNull();
  });

  it("arma descripción y título", () => {
    expect(sharedDescription({ text: "", title: "", url: "https://a.mx" }, "Ana", "Hola")).toBe(
      "De Ana (WhatsApp/compartido):\nHola\nhttps://a.mx",
    );
    expect(firstLine("\n  Primera línea\nsegunda")).toBe("Primera línea");
    expect(firstLine("a".repeat(200), 10)).toBe("aaaaaaaaa…");
  });
});
