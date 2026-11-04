/** Control de cambios simultáneos entre dispositivos (bloqueo optimista con updated_at). */
export const CONFLICT_MESSAGE =
  "Esto se modificó en otro dispositivo mientras lo editabas. Recarga la página para ver la versión actual y vuelve a aplicar tus cambios.";

/** Versión enviada por el formulario, o null si no viene (formularios antiguos). */
export function readVersion(formData: FormData): string | null {
  const v = String(formData.get("version") ?? "").trim();
  return v && !Number.isNaN(Date.parse(v)) && v.length <= 40 ? v : null;
}

/** Pantallas con formularios: no se refrescan solas para no interrumpir lo que escribes. */
export function isEditing(pathname: string): boolean {
  return /\/(nueva|capturar)$/.test(pathname) || /^\/(tareas|agenda|dashboard\/incidencias)\/[0-9a-f-]{36}$/.test(pathname);
}
