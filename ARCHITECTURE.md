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

## Agenda y tareas (Fase 1)

- Fechas y horas se capturan en hora local (America/Mexico_City) y se guardan en UTC (`src/lib/zoned-time.ts`).
- Recordatorios: una fila en `reminders` por tarea o reunión (`src/lib/reminders-server.ts`). El envío llega en la Fase 4.
- Recurrencias (`src/lib/recurrence.ts`, `src/lib/recurrence-server.ts`): subconjunto de RRULE calculado sobre fechas locales.
  - Tareas: solo existe una repetición abierta; al terminarla o cancelarla se crea la siguiente.
  - Reuniones: se generan las repeticiones de los próximos 60 días y se rellenan al consultar la agenda.
  - Índices únicos evitan duplicados aunque dos dispositivos generen la misma repetición a la vez.

## Sincronización entre dispositivos (Fase 1.6)

- La fuente de verdad es Supabase; los dispositivos no guardan copias locales de los datos.
- `src/components/live-sync.tsx` vuelve a pedir los datos (`router.refresh()`) al volver a la app, al reconectar y cada 60 s, excepto en pantallas con formulario.
- Las ediciones usan bloqueo optimista: el formulario envía `updated_at` y la actualización solo procede si no cambió (`src/lib/concurrency.ts`).
- Se evaluó Supabase Realtime; se pospone porque requiere publicar tablas y abrir WebSockets, y para dos dispositivos personales basta con este esquema.

## Asistente con IA (Fase 2)

- `src/lib/assistant/run.ts`: un turno = guardar mensaje del usuario → llamar a Claude (`client.beta.messages.create`, prompt de sistema cacheado, esfuerzo medio, respaldo de modelo del lado del servidor) → ejecutar herramientas → repetir (máx. 8 rondas) → guardar cada mensaje tal cual.
- El contexto (fecha y hora local, memoria confirmada, estado de las propuestas) viaja dentro del mensaje del usuario para no modificar el historial previo.
- `src/lib/assistant/tools.ts`: herramientas estrictas. Lectura: `consultar_agenda`, `buscar_tareas`, `consultar_memoria`. Propuesta: `proponer_tarea`, `proponer_reunion`, `proponer_completar_tarea`, `proponer_recordar` (insertan en `assistant_actions` con estado `pending`).
- `src/lib/assistant/execute.ts`: ejecuta una propuesta solo desde la acción de servidor `decideAction`, tras la confirmación del usuario.
- Todas las consultas usan la sesión del usuario (RLS), nunca la clave de servicio.

## Preparación para fases futuras

- El esquema ya incluye las tablas de todas las fases (correos, notificaciones con deduplicación, suscripciones push por dispositivo, resúmenes, podcasts, incidencias, memoria) para no rehacer el modelo, pero **no hay lógica de esas fases implementada**.
- `.env.example` documenta las variables de cada fase.
- Las pantallas de módulos futuros muestran su fase y no presentan datos simulados.
