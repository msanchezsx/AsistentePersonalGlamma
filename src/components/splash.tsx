/**
 * Pantalla de arranque: caja de cartón que gira y rebota, con su sombra. Solo CSS (sin JavaScript):
 * aparece al abrir la app (carga completa) y se desvanece sola a los ~1.8 s.
 */
export function Splash() {
  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-out-cube">
        <div className="splash-shadow" />
        <div className="splash-stage">
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
        </div>
      </div>
      <p className="splash-title">Asistente</p>
    </div>
  );
}
