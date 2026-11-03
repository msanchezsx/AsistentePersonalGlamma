# Asistente Ejecutivo Personal

Aplicación privada (PWA) que funciona como "segundo cerebro" profesional: agenda inteligente, tareas, seguimientos, correo Outlook, resúmenes diarios, podcast y análisis de productividad, apoyada por Claude API.

> Estado: **Fase 0 — Preparación técnica**. Ver [PROGRESS.md](PROGRESS.md).

## Tecnología

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PWA · Supabase (PostgreSQL, Auth, RLS) · Vercel. En fases posteriores: Claude API, n8n, Microsoft Graph, Recharts.

## Requisitos

- Node.js 20.9 o superior (probado con 22.23) y npm 10.
- Un proyecto de Supabase.
- PostgreSQL 15+ local solo si quieres ejecutar las pruebas de base de datos (`npm run db:test`).

## Puesta en marcha (desarrollo)

```bash
npm install
cp .env.example .env.local      # completa los valores de Supabase y ALLOWED_EMAILS
npm run dev                      # http://localhost:3000
```

Vista previa de la interfaz sin Supabase (solo en desarrollo):

```bash
UI_PREVIEW=1 npm run dev
```

## Base de datos

1. En Supabase → SQL Editor, ejecuta el contenido de `supabase/migrations/20261103000001_initial_schema.sql`.
   (O con la CLI: `npx supabase link --project-ref <ref>` y `npx supabase db push`.)
2. En Authentication → Sign In / Providers: deja activo **Email**, desactiva **Allow new users to sign up**.
3. En Authentication → Users → **Invite user**: invita tu correo (el mismo de `ALLOWED_EMAILS`).
4. En Authentication → URL Configuration: `Site URL` = URL de la app y agrega `<URL>/auth/callback` en Redirect URLs.

Detalle del modelo: [DATABASE.md](DATABASE.md).

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Build y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Verificación de tipos |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run db:test` | Aplica las migraciones en un Postgres local desechable y prueba RLS |
| `npm run check` | lint + tipos + pruebas + build |
| `npm run icons` | Regenera los iconos de la PWA (requiere Playwright) |

## Estructura

```
src/
  app/
    (app)/            Pantallas privadas con menú (Inicio, Agenda, … Configuración)
    login/            Inicio de sesión por enlace mágico
    auth/             callback (enlace mágico) y signout
    dispositivo/      Pantalla de dispositivo pendiente / revocado
    offline/          Pantalla sin conexión (PWA)
    api/health/       Estado de la app
    manifest.ts       Manifest de la PWA
  components/         Componentes de interfaz
  lib/                env, supabase, dispositivos, fechas, sesión, navegación
  middleware.ts       Sesión + dispositivo autorizado en cada petición
public/               sw.js (service worker) e iconos
supabase/migrations/  Esquema SQL versionado
supabase/tests/       Pruebas de RLS
tests/                Pruebas unitarias
docs/capturas/        Capturas de la interfaz
```

## Documentación

[ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE.md](DATABASE.md) · [SECURITY.md](SECURITY.md) · [CHANGELOG.md](CHANGELOG.md) · [PROGRESS.md](PROGRESS.md)
