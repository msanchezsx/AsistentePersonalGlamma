/**
 * Contenido compartido desde otras apps (Fase 7, Web Share Target).
 * Solo se procesa lo que el usuario comparte a propósito: sin scraping.
 */

export type SharedContent = { text: string; title: string; url: string };

const MAX = 4000;

export function readShared(sp: Record<string, string | undefined>): SharedContent {
  const clean = (v: string | undefined, max = MAX) => (v ?? "").toString().replace(/\u0000/g, "").trim().slice(0, max);
  const url = clean(sp.url, 1000);
  return {
    text: clean(sp.text),
    title: clean(sp.title, 300),
    url: /^https?:\/\//i.test(url) ? url : "",
  };
}

/**
 * Mensaje de WhatsApp reenviado: quita encabezados del tipo
 * "[4/11/26, 10:15] Ana Pérez: " para quedarse con el texto.
 */
export function stripChatHeaders(text: string): { body: string; author: string | null } {
  let author: string | null = null;
  const body = text
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(?:\s?[ap]\.?\s?m\.?)?\]?\s*-?\s*([^:]{1,60}):\s?(.*)$/i);
      if (m) {
        author ??= m[1].trim();
        return m[2];
      }
      return line;
    })
    .join("\n")
    .trim();
  return { body, author };
}

/** Texto completo para la descripción (incluye enlace y autor si los hay). */
export function sharedDescription(s: SharedContent, author: string | null, body: string): string {
  return [author ? `De ${author} (WhatsApp/compartido):` : "Compartido:", body, s.url].filter(Boolean).join("\n").slice(0, MAX);
}

/** Primera línea útil, para usar como título. */
export function firstLine(text: string, max = 120): string {
  const line = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
