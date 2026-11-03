/** Logo de la app: caja de cartón (la empresa fabrica cajas). Mismo dibujo que los iconos de la PWA. */
export const BOX_PATHS = `
  <g stroke="#6b4423" stroke-width="10" stroke-linejoin="round">
    <polygon points="256,112 408,186 256,260 104,186" fill="#e3b47c"/>
    <polygon points="104,186 256,260 256,424 104,350" fill="#c68a4d"/>
    <polygon points="256,260 408,186 408,350 256,424" fill="#a86f38"/>
  </g>
  <polygon points="168,148 196,134 350,209 322,223" fill="#f4e2bc"/>
  <polygon points="322,223 350,209 350,277 322,291" fill="#e9cf9a"/>`;

export function BoxLogo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="Asistente">
      <rect width="512" height="512" rx="112" fill="#1d4ed8" />
      <g dangerouslySetInnerHTML={{ __html: BOX_PATHS }} />
    </svg>
  );
}
