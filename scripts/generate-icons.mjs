// Genera los iconos PNG de la PWA a partir de un SVG (requiere Playwright).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";

import { readFileSync } from "node:fs";

// Caja de cartón: se toma el dibujo de src/components/box-logo.tsx para que app e iconos coincidan.
const BOX_PATHS = readFileSync("src/components/box-logo.tsx", "utf8").match(/BOX_PATHS = `([\s\S]*?)`/)[1];

// maskable: fondo a sangre y la caja reducida dentro de la zona segura (80 %).
const svg = (maskable) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${maskable ? 0 : 112}" fill="#1d4ed8"/>
  <g transform="${maskable ? "translate(256 266) scale(0.95) translate(-256 -268)" : "translate(0 -12)"}">${BOX_PATHS}</g>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, size, maskable] of [
  ["caja-192.png", 192, false],
  ["caja-512.png", 512, false],
  ["caja-maskable-512.png", 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg(maskable)}`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
}
await browser.close();
console.log("Iconos generados en public/icons");
