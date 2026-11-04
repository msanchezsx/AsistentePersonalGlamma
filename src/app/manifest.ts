import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Asistente",
    short_name: "Asistente",
    description: "Tu asistente personal con inteligencia artificial.",
    lang: "es-MX",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any", // celular vertical y tablet horizontal
    background_color: "#f6f7f9",
    theme_color: "#f6f7f9",
    categories: ["productivity", "business"],
    // Fase 7: aparece en "Compartir" de Android (WhatsApp y otras apps).
    share_target: { action: "/compartir", method: "GET", params: { title: "title", text: "text", url: "url" } },
    // Solo 144 px a propósito: más chico que el mínimo de Chrome para la pantalla de
    // arranque en celulares, así Android no muestra imagen antes de la caja girando.
    icons: [
      { src: "/icons/caja-144.png", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/icons/caja-maskable-144.png", sizes: "144x144", type: "image/png", purpose: "maskable" },
    ],
  };
}
