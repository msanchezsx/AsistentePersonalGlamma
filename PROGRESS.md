# Avance del proyecto

| Fase | Estado |
|---|---|
| 0. Preparación técnica | 🟡 Código listo y probado localmente; falta repositorio, Supabase y despliegue |
| 1. Agenda inteligente | ⏸ Espera aprobación de la Fase 0 |
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
| 0.11 | Crear repositorio GitHub | ⏳ | Requiere que el usuario cree `msanchezsx/asistente-ejecutivo` (privado) |
| 0.12 | Crear proyecto Supabase y aplicar migración | ⏳ | Requiere al usuario |
| 0.13 | Desplegar en Vercel | ⏳ | Requiere al usuario (conectar repo y variables) |

## Pruebas ejecutadas (2026-11-03)

- `npm run lint` ✅ · `npm run typecheck` ✅ · `npm test` ✅ 13/13 · `npm run db:test` ✅ 33/33 · `npm run build` ✅
- Servidor de producción: `/` y `/configuracion` → 307 a `/login` sin sesión; `/login` 200; `/api/health` 200; `/manifest.webmanifest` y `/sw.js` 200; cabeceras de seguridad presentes.

## Pendientes para cerrar la Fase 0

1. Repositorio GitHub → push del código.
2. Proyecto Supabase → aplicar migración, desactivar registros, invitar el correo del usuario, configurar URLs.
3. Proyecto Vercel → variables de entorno → despliegue.
4. Prueba integral: login desde el celular (se activa), login desde la tablet (queda pendiente), aprobar desde el celular, revocar y volver a aprobar, instalar la PWA en ambos.

## Siguiente actividad

Al aprobar la Fase 0: **Fase 1 — Agenda inteligente**, empezando por el CRUD de tareas.
