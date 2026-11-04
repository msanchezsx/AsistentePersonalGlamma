/**
 * Mensaje para el usuario según el error de Supabase al pedir el enlace.
 * null = responder como si todo estuviera bien (p. ej. correo no invitado),
 * para no revelar qué cuentas existen.
 */
export function loginErrorMessage(error: { status?: number; code?: string; message?: string }): string | null {
  const code = error.code ?? "";
  if (error.status === 429 || code.includes("rate_limit")) {
    return code === "over_email_send_rate_limit"
      ? "Se alcanzó el límite de correos de acceso por hora del servidor. Espera alrededor de una hora y vuelve a intentarlo (los enlaces anteriores siguen sirviendo si no han vencido)."
      : "Pediste un enlace hace muy poco. Espera un minuto antes de pedir otro y usa el último correo que te llegó.";
  }
  if (error.status === 422 || error.status === 400) return null;
  return "No se pudo enviar el enlace. Intenta de nuevo en unos minutos.";
}
