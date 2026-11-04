# Seguridad

## Controles implementados (Fase 0)

| Control | Implementación |
|---|---|
| Autenticación | Supabase Auth con enlace mágico. Sin contraseñas. `shouldCreateUser: false` + registros desactivados en Supabase + lista `ALLOWED_EMAILS` validada en el login y en el callback. Respuesta idéntica para correos no autorizados. |
| Sesiones | Cookies de `@supabase/ssr` refrescadas en el middleware; `getUser()` valida el JWT con Supabase en cada petición. Cierre de sesión solo por POST. |
| Dispositivos autorizados | Token aleatorio de 256 bits en cookie `httpOnly`, `secure`, `SameSite=Lax`. En la BD solo el hash SHA-256. Primer dispositivo activo; los demás requieren aprobación desde un dispositivo activo; máximo 2 por defecto; revocación inmediata (el middleware lo bloquea en la siguiente petición). |
| Protección de rutas y endpoints | Middleware: sin sesión → `/login`; sin dispositivo activo → `/dispositivo` o `403` en `/api/*`. |
| RLS | En todas las tablas, `force row level security`; el rol `anon` no tiene permisos; tablas sensibles (`devices`, `audit_log`, `notifications`) sin escritura directa. |
| Integridad entre usuarios | FKs compuestas `(id, user_id)`. |
| Validación de datos | Zod en el servidor (correo, ids) + `CHECK` y longitudes en la BD. |
| Auditoría | `audit_log` con old/new por triggers y eventos de dispositivos. Inmutable vía API. |
| Variables de entorno | Claves solo en servidor; únicamente la URL y la clave pública de Supabase llevan `NEXT_PUBLIC_`. `.env*` en `.gitignore` (excepto `.env.example`). |
| Cabeceras HTTP | CSP restrictiva (solo el propio dominio y `*.supabase.co`), `X-Frame-Options: DENY`, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (sin cámara, micrófono, ubicación ni pagos), `noindex`. |
| PWA | El service worker no cachea páginas ni respuestas con datos personales; solo estáticos. |
| Asistente (Fase 2) | `ANTHROPIC_API_KEY` solo en el servidor (Secret en Vercel, sin `NEXT_PUBLIC_`); el navegador nunca llama a Claude. Las herramientas de escritura solo crean propuestas en `assistant_actions` (lista blanca por `CHECK`); se ejecutan únicamente cuando el usuario toca Confirmar, con bloqueo para que un doble toque no ejecute dos veces. Las entradas de las herramientas se validan con Zod. No hay herramientas para enviar correos o mensajes, ni para borrar datos. El historial de mensajes no se puede editar. |
| Avisos y compartir (Fases 4 y 7) | Los avisos se generan en el propio equipo con datos ya visibles para el usuario; el service worker solo abre rutas internas al tocar un aviso. Lo compartido llega por URL, se limita en tamaño, los enlaces solo se aceptan `http(s)` y nada se guarda sin una acción del usuario. Sin acceso a WhatsApp ni scraping. |
| Avisos programados (Fase 4) | `/api/cron/avisos` es público para el programador pero exige `CRON_SECRET`; solo lee y envía avisos, no modifica tareas ni reuniones. La clave de servicio solo se usa ahí y al registrar la suscripción de un dispositivo autorizado. Las llaves VAPID y el secreto se generan en el servidor y no se guardan en la base ni en el código. El contenido del aviso solo lleva título, detalle y una ruta interna. |
| Datos de prueba | Solo ficticios (`example.com`, "Cliente Demo"). |

## Riesgos residuales conocidos

1. **El control de dispositivo vive en el servidor de Next.js, no en RLS.** Alguien que robe el JWT de la sesión podría consultar Supabase directamente con la clave pública. Mitigaciones: sesiones de corta duración en Supabase, revocación de sesión al revocar dispositivo (pendiente, requiere service role en Fase 4), y en una fase futura mover el acceso a datos solo al servidor o firmar el dispositivo dentro del JWT.
2. `script-src 'unsafe-inline'` en la CSP (requerido por Next.js sin nonces). Se puede endurecer con nonces más adelante.

## Reglas para fases siguientes

- Outlook: empezar con `Mail.Read` y `offline_access`; tokens OAuth cifrados (AES-GCM con `TOKEN_ENCRYPTION_KEY`) y solo en el servidor. Nunca enviar, borrar ni modificar correos sin autorización explícita.
- Claude API: solo desde el servidor; las acciones que la IA proponga pasan por una lista blanca y confirmación del usuario cuando crean o modifican datos externos.
- n8n: endpoints internos con secreto compartido (`N8N_WEBHOOK_SECRET`) y validación de cuerpo.
- WhatsApp: solo contenido compartido por el usuario (Web Share Target); sin scraping.

## Reportar un problema

Proyecto privado: comunica cualquier hallazgo directamente al propietario.
