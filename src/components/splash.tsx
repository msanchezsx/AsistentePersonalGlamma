import { GlamaLogo } from "@/components/glama-logo";

/**
 * Pantalla de arranque: caja de cartón girando. Solo CSS (sin JavaScript):
 * aparece al abrir la app (carga completa) y se desvanece sola a los ~1.8 s.
 */
export function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-scene">
        <div className="splash-cube">
          <div className="face front" />
          <div className="face back" />
          <div className="face right" />
          <div className="face left" />
          <div className="face top" />
          <div className="face bottom" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <GlamaLogo className="w-24" priority />
        <p className="splash-title">Asistente</p>
      </div>
    </div>
  );
}
