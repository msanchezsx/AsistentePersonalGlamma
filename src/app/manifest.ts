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
    theme_color: "#1d4ed8",
    categories: ["productivity", "business"],
    // Fase 7: aparece en "Compartir" de Android (WhatsApp y otras apps).
    share_target: { action: "/compartir", method: "GET", params: { title: "title", text: "text", url: "url" } },
    icons: [
      { src: "/icons/caja-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/caja-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/caja-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
