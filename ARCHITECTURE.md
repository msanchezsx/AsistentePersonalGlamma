# Arquitectura

## Visión general

```
 Celular / Tablet Android (PWA instalada)
            │ HTTPS
            ▼
 ┌───────────────────────────┐        ┌─────────────────────────┐
 │ Next.js en Vercel         │        │ Supabase Cloud          │
 │  • Páginas (App Router)   │◄──────►│  • PostgreSQL + RLS     │
 │  • Middleware: sesión +   │  JWT   │  • Auth (enlace mágico) │
 │    dispositivo autorizado │        │  • Storage (audio, F5)  │
 │  • Server Actions / API   │        └─────────────────────────┘
 │  • Claves solo en servidor│                 ▲
 └──────────┬────────────────┘                 │ service role (F4)
            │ (F2) Claude API                  │
            │ (F3) Microsoft Graph       ┌─────┴──────┐
            ▼                            │ n8n (F4)   │ recordatorios, resúmenes,
       Servicios externos                └────────────┘ cierre de jornada, push
```

- **La app no depende de que Claude Code esté abierto**: es una aplicación web desplegada en Vercel con datos en Supabase.
- **La IA nunca se llama desde el navegador.** El navegador habla con el servidor de Next.js; el servidor llama a Claude con la clave guardada en variables de entorno, valida la respuesta y solo ejecuta acciones permitidas (Fase 2).
- **n8n** se comunicará con endpoints internos protegidos por un secreto compartido (Fase 4).

## Decisiones técnicas (Fase 0)

| Decisión | Motivo |
|---|---|
| Next.js 15 (App Router) y no 16 | Versión estable con amplio soporte de `@supabase/ssr` y Vercel; se puede actualizar después. |
| `@supabase/ssr` con cookies | Sesión compartida entre servidor y cliente, refrescada en el middleware. |
| Enlace mágico (sin contraseña) y registros cerrados | No hay contraseñas que filtrar; solo el correo invitado puede entrar (`ALLOWED_EMAILS` + registro desactivado en Supabase). |
| Dispositivos autorizados con token en cookie httpOnly | Cumple "solo mi celular y mi tablet": el primer dispositivo se activa, los siguientes requieren aprobación desde uno activo; se pueden revocar. |
| Funciones `security definer` para dispositivos | El usuario no puede autoaprobarse modificando la tabla directamente. |
| Llaves foráneas compuestas `(id, user_id)` | Impiden relacionar datos propios con filas de otro usuario aunque se conozca su id. |
| Estados como `text + CHECK` | Más fácil de evolucionar que tipos `enum`. |
| Service worker propio, sin plugin | Control total: no se cachean páginas ni datos personales, solo recursos estáticos. |
| Fuente del sistema (Roboto en Android) | Sin dependencias externas en build ni en runtime; compatible con la CSP. |
| Vitest + pruebas SQL en Postgres local | Pruebas rápidas sin depender de servicios externos. |

## Flujo de autenticación

1. `/login`: el usuario escribe su correo. El servidor valida que esté en `ALLOWED_EMAILS` y pide a Supabase un enlace mágico (`shouldCreateUser: false`). La respuesta es la misma para cualquier correo.
2. `/auth/callback`: intercambia el código por sesión, vuelve a validar el correo, genera (o reutiliza) el token del dispositivo, llama a `register_device` y guarda la cookie `ae_device`.
3. `middleware.ts` en cada petición: refresca la sesión (`getUser()` valida con Supabase), exige sesión y exige que `device_status` sea `active`. Si no, redirige a `/dispositivo` (o 403 en `/api/*`).
4. Configuración → Dispositivos: aprobar o revocar.

## Preparación para fases futuras

- El esquema ya incluye las tablas de todas las fases (correos, notificaciones con deduplicación, suscripciones push por dispositivo, resúmenes, podcasts, incidencias, memoria) para no rehacer el modelo, pero **no hay lógica de esas fases implementada**.
- `.env.example` documenta las variables de cada fase.
- Las pantallas de módulos futuros muestran su fase y no presentan datos simulados.
