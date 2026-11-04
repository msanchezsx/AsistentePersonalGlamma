# Avance del proyecto

| Fase | Estado |
|---|---|
| 0. Preparación técnica | 🟢 Desplegada en producción; pendiente prueba de autorización del celular |
| 1. Agenda inteligente | 🟢 Completa (1.6 pendiente de prueba del usuario) |
| 2. Inteligencia artificial | 🟡 Publicada y migración aplicada; pendiente la clave de Claude (de pago, el usuario la pospuso) |
| 3. Outlook | ⏸ Pospuesta: falta registrar la app en Azure (guía en docs/GUIA-OUTLOOK-AZURE.md) |
| 4. Automatizaciones | 🟡 Publicada sin servicios externos; falta prueba del usuario. Push con app cerrada y n8n pendientes |
| 5. Podcast | 🟡 Publicada con voz del equipo; falta prueba del usuario |
| 6. Inteligencia y productividad | 🟡 Publicada; falta prueba del usuario |
| 7. WhatsApp | 🟡 Publicada (compartir); falta prueba del usuario |
| 8. Puesta en producción | ⏸ |

## Fase 0 — Diagnóstico del entorno (2026-11-03)

El desarrollo se ejecuta en un contenedor en la nube de Claude Code (no en la computadora del usuario). El contenedor es temporal: el código debe vivir en GitHub.

| Herramienta | Resultado |
|---|---|
| Sistema operativo | Ubuntu 24.04.5 LTS x86_64 |
| Node.js | v22.23.4 ✅ |
| npm | 10.9.9 ✅ |
| Git | 2.43.0 ✅ |
| Claude Code | 2.1.317 ✅ |
| PostgreSQL local | 16.15 ✅ (para pruebas de RLS) |
| Registro npm | accesible ✅ |
| Docker | no disponible (no se usa Supabase local) |
| Red hacia supabase.com, vercel.com, graph.microsoft.com | bloqueada por la política de red del entorno ❌ |

## Fase 0 — Actividades

| # | Actividad | Estado | Validación |
|---|---|---|---|
| 0.1 | Revisar entorno | ✅ | Tabla anterior |
| 0.2 | Crear proyecto Next.js + TS + Tailwind | ✅ | `npm run build` sin errores |
| 0.3 | Estructura de carpetas | ✅ | Ver README |
| 0.4 | Variables de entorno | ✅ | `.env.example`, validación con Zod (`tests/env.test.ts`) |
| 0.5 | Esquema inicial + RLS | ✅ | `npm run db:test`: 33/33 comprobaciones |
| 0.6 | Autenticación + dispositivos | ✅ código / ⏳ prueba real | Middleware probado sin Supabase (redirecciones). Falta probar el enlace mágico contra un Supabase real. |
| 0.7 | Seguridad base | ✅ | Cabeceras verificadas con `curl -I`; RLS probadas |
| 0.8 | Interfaz base | ✅ | Capturas en `docs/capturas/` (celular y tablet), sin errores de consola |
| 0.9 | PWA | ✅ código / ⏳ instalación | Manifest y `sw.js` servidos correctamente; instalación en Android se prueba tras desplegar |
| 0.10 | Documentación | ✅ | Este archivo y los demás `.md` |
| 0.11 | Crear repositorio GitHub | ✅ | `msanchezsx/AsistentePersonalGlamma`, código subido a `main` |
| 0.12 | Crear proyecto Supabase y aplicar migración | ✅ | Proyecto `kfjeywjkqouqnygxtmby`, esquema aplicado, registros cerrados, correo invitado, URLs configuradas |
| 0.13 | Desplegar en Vercel | ✅ | https://asistente-personal-glamma-yv4c.vercel.app — `/api/health` con `supabaseConfigured: true` |
| 0.14 | Instalar PWA en la tablet | ✅ | Instalada por el usuario (2026-11-03) |
| 0.15 | Autorizar el celular desde la tablet | ⏳ | Pospuesta por el usuario (no tenía el celular) |

## Pruebas ejecutadas (2026-11-03)

- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm test` ✅ 13/13 · `npm run db:test` ✅ 33/33 · `npm run build` ✅
- Servidor de producción: `/` y `/configuracion` → 307 a `/login` sin sesión; `/login` 200; `/api/health` 200; `/manifest.webmanifest` y `/sw.js` 200; cabeceras de seguridad presentes.

## Pendientes para cerrar la Fase 0

1. ~~Repositorio GitHub~~ ✅
2. ~~Supabase~~ ✅
3. ~~Vercel~~ ✅ (las variables `NEXT_PUBLIC_*` deben ser tipo **Config**, no Secret)
4. Prueba integral: login desde el celular (se activa), login desde la tablet (queda pendiente), aprobar desde el celular, revocar y volver a aprobar, instalar la PWA en ambos.

Guía paso a paso para el usuario: [docs/GUIA-SUPABASE-VERCEL.md](docs/GUIA-SUPABASE-VERCEL.md).

## Fase 1 — Actividades

| # | Actividad | Estado | Validación |
|---|---|---|---|
| 1.1 | Tareas (CRUD, estados, prioridad, urgente/importante, fecha con/sin hora) | ✅ | Probada por el usuario en la tablet (2026-11-03) |
| 1.2 | Reuniones y recordatorios | ✅ | Crear reunión probado por el usuario (2026-11-03). Los recordatorios se guardan; el aviso push llega en la Fase 4 |
| 1.3 | Recurrencias | ✅ Probada por el usuario (2026-11-03) | 56 pruebas unitarias, 51 comprobaciones SQL, build OK |
| 1.4 | Vistas diaria y semanal | ✅ Probada por el usuario (2026-11-03) | 65 pruebas unitarias, 51 comprobaciones SQL, build OK. Sin migración |
| 1.5 | Registro por texto y voz | ✅ Voz con el micrófono del teclado (decisión del usuario 2026-11-03: el dictado de Chrome no funciona en su tablet) | 76 pruebas unitarias, build OK |
| 1.6 | Sincronización entre dispositivos | 🟡 Publicada, falta prueba del usuario | 78 pruebas unitarias, 53 comprobaciones SQL, build OK. Sin migración |
| 1.7 | Proyectos, clientes y seguimientos | 🟡 Publicada, falta prueba del usuario | 110 pruebas unitarias, build OK. Sin migración |
| 1.8 | Avisos críticos a pantalla completa | 🟡 Publicada; falta migración 0005 y prueba del usuario | 112 pruebas unitarias, pruebas SQL, build OK |

Nota: no hay acceso de red desde el entorno de desarrollo a Supabase, por lo que las consultas reales se validan en producción por el usuario.

## Fase 2 — Actividades

| # | Actividad | Estado | Validación |
|---|---|---|---|
| 2.1 | Conexión con Claude API (servidor) | ✅ Código listo | Falta `ANTHROPIC_API_KEY` en Vercel |
| 2.2 | Asistente conversacional con historial | ✅ Código listo | Pantalla Asistente |
| 2.3 | Consultas a la base (agenda, tareas, memoria) | ✅ Código listo | 84 pruebas unitarias |
| 2.4 | Acciones autorizadas (proponer → confirmar) | ✅ Código listo | Pruebas SQL: lista blanca, aislamiento, mensajes no editables |
| 2.5 | Memoria estructurada | ✅ Código listo | Pantalla Memoria |

Pendiente del usuario: ejecutar `20261103000004_assistant.sql` en Supabase y agregar `ANTHROPIC_API_KEY`; después probar en la tablet.

## Fases 4 a 7 — Actividades (2026-11-04, sin costo ni cuentas nuevas)

| Fase | Entregado | Validación |
|---|---|---|
| 4 | Resumen de la mañana, cierre del día, pasar pendientes a mañana, alertas en Inicio, avisos de recordatorios en el equipo | 100 pruebas unitarias, build OK. Sin migración |
| 5 | Podcast con voz del equipo e historial de 7 días | Idem |
| 6 | Dashboard, recomendaciones, análisis de problemas (5 porqués, Ishikawa, plan de acción) | Idem |
| 7 | Compartir desde WhatsApp → tarea, reunión o nota | Idem |

Pendientes que requieren servicios externos o decisión del usuario: clave de Claude (Fase 2), Azure para Outlook (Fase 3), avisos con la app cerrada y n8n (Fase 4), voz de mayor calidad (TTS de pago, Fase 5).

## Siguiente actividad

Prueba de las Fases 4–7 por el usuario en la tablet. Después, Fase 8 (pruebas integrales, revisión de seguridad, instalación en el celular y documentación final).
