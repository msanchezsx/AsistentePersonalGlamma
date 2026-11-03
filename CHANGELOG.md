# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Agregado (Fase 1.2 — Reuniones y recordatorios)
- Agenda: reuniones agrupadas por día (desde hoy), crear, editar, marcar como realizada / no asistí, cancelar y eliminar.
- Participantes escritos a mano (separados por coma), lugar o enlace, proyecto y cliente.
- Recordatorios relativos (a la hora, 5 min … 1 día antes) para reuniones y tareas; se cancelan al completar/cancelar. El envío de notificaciones llega en la Fase 4.
- Inicio: "Próximas reuniones" con datos reales.
- Las reuniones se guardan solo en la agenda propia; no se envían invitaciones.

### Agregado (Fase 1.1 — Tareas)
- Pantalla Tareas: grupos Vencidas, Hoy, Mañana, Próximas, Sin fecha y Cerradas (14 días).
- Crear, editar, completar (confirmado por el usuario), poner en proceso/espera, cancelar, reabrir y eliminar tareas.
- Fecha límite con o sin hora ("todo el día"), prioridad 1–5, urgente/importante, proyecto y cliente.
- Inicio: tarjeta "Tareas prioritarias" con datos reales y acceso rápido a "Nueva tarea".
- Migración `20261103000002_tasks_all_day.sql` (columna `tasks.due_all_day`).
- Conversión hora local ↔ UTC sin dependencias (`src/lib/zoned-time.ts`).

### Cambiado
- Se acepta `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (nombre actual de Supabase) además de `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## [0.1.0] - 2026-11-03 — Fase 0

### Agregado
- Proyecto Next.js 15 + TypeScript + Tailwind CSS 4.
- Esquema PostgreSQL inicial (22 tablas) con RLS, FKs compuestas, triggers de `updated_at` y auditoría, y funciones de dispositivos.
- Pruebas de RLS en Postgres local (`npm run db:test`) y pruebas unitarias con Vitest.
- Autenticación por enlace mágico con lista de correos autorizados.
- Registro, aprobación y revocación de dispositivos (máximo 2).
- Middleware de sesión y dispositivo autorizado.
- Interfaz base: menú de 9 módulos (barra inferior en celular, lateral en tablet), Inicio, Configuración y pantallas de módulos futuros.
- PWA: manifest, iconos, service worker conservador y pantalla sin conexión.
- Cabeceras de seguridad (CSP, HSTS, etc.).
- Documentación: README, ARCHITECTURE, DATABASE, SECURITY, PROGRESS, `.env.example`.
