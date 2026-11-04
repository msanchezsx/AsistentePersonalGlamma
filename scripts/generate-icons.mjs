// Genera los iconos PNG de la PWA con Playwright (requiere Playwright).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { mkdirSync, readFileSync } from "node:fs";

// El icono es la misma caja 3D de la pantalla de arranque (src/app/globals.css,
// .splash-cube) en su primer cuadro, para que el arranque de Android (que siempre
// muestra el icono) se vea como la caja quieta que enseguida empieza a girar.
const css = readFileSync("src/app/globals.css", "utf8");
const cubeCss = css.slice(css.indexOf(".splash-scene {"), css.indexOf(".splash-title {"));
const BG = "#f6f7f9"; // = background_color del manifest y --bg de la app
const cube = `<div class="splash-scene"><div class="splash-cube" style="animation:none;transform:rotateX(-22deg) rotateY(35deg)">
  <div class="face front"></div><div class="face back"></div><div class="face right"></div>
  <div class="face left"></div><div class="face top"></div><div class="face bottom"></div></div></div>`;

mkdirSync("public/icons", { recursive: true });
const browser = await chromium.launch();
// box = lado del lienzo en px CSS (= dp en el teléfono). maskable: fondo a sangre y
// la caja dentro de la zona segura (círculo del 80 %).
for (const [file, size, box, maskable] of [
  // El nombre lleva versión (-3d): el teléfono y el service worker guardaban los
  // iconos viejos con el mismo nombre y Android seguía mostrando la caja plana.
  ["caja-3d-192.png", 192, 165, false],
  ["caja-3d-512.png", 512, 165, false],
  ["caja-3d-maskable-512.png", 512, 205, true],
]) {
  const page = await browser.newPage({ viewport: { width: box, height: box }, deviceScaleFactor: size / box });
  await page.setContent(`<style>${cubeCss}
    html,body{margin:0;height:100%;background:${maskable ? BG : "transparent"}}
    body{display:flex;align-items:center;justify-content:center}</style>${cube}`);
  await page.screenshot({ path: `public/icons/${file}`, omitBackground: !maskable });
  await page.close();
}
await browser.close();
console.log("Iconos generados en public/icons");
