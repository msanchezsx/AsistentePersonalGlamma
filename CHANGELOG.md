# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Agregado (Fase 1.6 — Sincronización entre dispositivos)
- Las pantallas se actualizan solas al volver a la app, al recuperar la conexión y cada minuto mientras están a la vista (no en formularios, para no interrumpir).
- Ediciones simultáneas: si una tarea o reunión cambió en otro dispositivo mientras la editabas, no se sobrescribe; se pide recargar (bloqueo optimista con `updated_at`).
- Aviso "Sin conexión" en la parte superior.
- `Permissions-Policy`: micrófono desactivado (el dictado es con el teclado).

### Agregado (Fase 1.5 — Registro por texto y voz)
- Pantalla **Capturar** (acceso desde Inicio): escribe o dicta una frase como "Junta con Ana mañana a las 10 por 30 minutos".
- Intérprete en español sin IA ni red (`src/lib/capture.ts`): distingue tarea o reunión, fecha (hoy, mañana, días de la semana, "15 de noviembre", "20/12"), hora (a las 4, 4 pm, de la tarde, mediodía, rangos), duración, participantes, repetición, urgente e importante.
- Voz: se dicta con el micrófono del teclado del equipo. El dictado de Chrome (Web Speech API) se probó y se retiró porque no devuelve texto en la tablet del usuario (decisión del usuario).
- Nada se guarda automáticamente: abre el formulario de tarea o reunión precargado para revisar y confirmar.

### Agregado (Fase 1.4 — Vistas diaria y semanal)
- Agenda con tres vistas: **Día**, **Semana** y **Próximas** (la lista anterior), con navegación anterior/siguiente y botón "Hoy".
- Día: tareas sin hora del día, horario con reuniones y tareas en orden, marca "Ahora", tareas vencidas (hoy) y tiempo libre dentro de la jornada 9:00–17:00.
- Semana: lunes a domingo (columnas en tablet horizontal, apilado en celular), minutos en reuniones por día y fines de semana marcados como descanso según `user_preferences.work_days`.
- Inicio → "Ver agenda" abre la vista Día.
- Lógica pura y probada en `src/lib/planner.ts`.

### Cambiado (ajustes pedidos por el usuario)
- La app se llama ahora "Asistente" (menú, inicio de sesión, título y manifest).
- Nuevo icono y logo: caja de cartón. Iconos regenerados con `scripts/generate-icons.mjs` con nombre nuevo (`/icons/caja-*.png`) para que Android detecte el cambio; caché del service worker en `v4`.
- Pantalla de arranque con una caja de cartón girando, sin logo (solo CSS; se quita sola a los ~2 s).
- Logo de Productos Glama en el menú lateral, el inicio de sesión, y el encabezado de Inicio en celular (`public/brand/glama-logo.png`).
- Configuración → Cuenta: campo "¿Cómo te saludo?" (`profiles.preferred_name`) para el saludo de Inicio.

### Agregado (Fase 1.3 — Actividades recurrentes)
- Campo "Repetir" en tareas y reuniones: todos los días, de lunes a viernes, cada semana, cada 2 semanas o cada mes, con fecha final opcional.
- Tareas: al terminar o cancelar una tarea que se repite se crea la siguiente (nunca en el pasado) con su recordatorio. Botón "Dejar de repetir".
- Reuniones: se agendan las repeticiones de los próximos 60 días y se rellenan al abrir Inicio o Agenda. "Detener repetición desde aquí" termina la serie y quita las siguientes programadas.
- Migración `20261103000003_recurrences.sql`: `recurrence_rules.applies_to`, `recurrence_rules.reminder_minutes` e índices únicos que impiden repeticiones duplicadas.
- Cálculo de repeticiones sin dependencias (`src/lib/recurrence.ts`), probado con fines de semana, semanas alternas y meses sin día 31.

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
