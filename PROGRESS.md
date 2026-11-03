# Avance del proyecto

| Fase | Estado |
|---|---|
| 0. Preparación técnica | 🟢 Desplegada en producción; pendiente prueba de autorización del celular |
| 1. Agenda inteligente | 🟡 En curso (aprobada 2026-11-03) |
| 2. Inteligencia artificial | ⏸ |
| 3. Outlook | ⏸ |
| 4. Automatizaciones | ⏸ |
| 5. Podcast | ⏸ |
| 6. Inteligencia y productividad | ⏸ |
| 7. WhatsApp | ⏸ |
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
| 1.2 | Reuniones y recordatorios | 🟡 Publicada, falta prueba del usuario | 40 pruebas unitarias, 42 comprobaciones SQL, build OK. Los recordatorios se guardan; el aviso push llega en la Fase 4 |
| 1.3 | Recurrencias | ⏸ | |
| 1.4 | Vistas diaria y semanal | ⏸ | |
| 1.5 | Registro por texto y voz | ⏸ | |
| 1.6 | Sincronización entre dispositivos | ⏸ | |

Nota: no hay acceso de red desde el entorno de desarrollo a Supabase, por lo que las consultas reales se validan en producción por el usuario.

## Siguiente actividad

1.3 Recurrencias, tras validar 1.2.
