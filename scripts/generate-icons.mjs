// Genera los iconos PNG de la PWA a partir de un SVG (requiere Playwright).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync } from "node:fs";

const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#1d4ed8"/>
  <text x="256" y="${pad ? 300 : 318}" font-family="Roboto, Arial, sans-serif" font-size="${pad ? 150 : 200}"
        font-weight="700" fill="#ffffff" text-anchor="middle">AE</text>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [file, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg(maskable)}`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: true });
}
await browser.close();
console.log("Iconos generados en public/icons");
