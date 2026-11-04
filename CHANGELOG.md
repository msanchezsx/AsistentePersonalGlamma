# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Sin publicar]

### Agregado (Fase 4 — Avisos con la app cerrada)
- Web Push: `/api/cron/avisos` (protegido con `CRON_SECRET`, comparación en tiempo constante) envía recordatorios y avisos críticos que llegaron en los últimos 30 min. Se registra cada envío en `notifications` con llave única antes de enviar: no hay duplicados aunque el programador se repita. Suscripciones vencidas se borran.
- El service worker (`v6`) muestra el aviso; los críticos se quedan en pantalla y vibran.
- Configuración → Avisos registra el dispositivo (solo dispositivos autorizados; se escribe con la clave de servicio tras verificar sesión y dispositivo).
- Asistente de configuración en `/configuracion/servidor-avisos`: genera las llaves VAPID y el secreto en el servidor (no se guardan) para copiarlos a Vercel, y explica el programador gratuito (cron-job.org cada 5 min).
- Nueva dependencia: `web-push` (aprobada por el usuario el 2026-11-04). Sin migración.

### Agregado (avisos críticos, pedido del usuario)
- **Aviso a pantalla completa** para tareas críticas (prioridad "Crítica" o urgente + importante) y reuniones marcadas como **Reunión crítica**: aparece al llegar su recordatorio, su hora límite (las de todo el día a las 9:00) o 10 minutos antes de la reunión. Botones **Enterado**, **Ya lo realicé** (termina la tarea / marca la reunión como realizada), **Cancelar** (con confirmación) y **Recordar en 10 min**. También lanza un aviso del sistema que no se quita solo y vibra.
- Migración `20261104000005_meetings_critical.sql`: `meetings.is_critical`. El código tolera que aún no esté aplicada.
- `listTasks` se cachea por petición (se usa en el layout y en las pantallas).

### Agregado (Fase 1 — Proyectos, clientes y seguimientos)
- **Proyectos** (`/proyectos`) con tres secciones:
  - **Seguimientos:** "Yo debo" y "Me deben", con fecha compromiso, persona (existente o nueva), proyecto y cliente; se marcan como cumplidos con un toque. Los vencidos van primero.
  - **Proyectos / pedidos:** nombre, número de pedido, cliente, fechas y estado. El detalle muestra tareas abiertas, seguimientos y reuniones del proyecto.
  - **Clientes:** con contactos (puesto, teléfono y correo con enlace directo) y sus proyectos.
- Tarjeta **Seguimientos** en Inicio. Los proyectos y clientes aparecen al crear tareas y reuniones.
- Sin migración (tablas de la Fase 0). Edición con bloqueo optimista.

### Corregido
- El logo de Glama salía roto en la pantalla de inicio de sesión: el middleware redirigía `/brand/*` al login para usuarios sin sesión. Ahora `/brand/` se sirve como archivo estático (verificado: antes 307, ahora 200).
- Al pedir el enlace de acceso, el límite de envío de correos de Supabase se mostraba como un error genérico. Ahora se explica (esperar ~1 hora, o 1 minuto entre solicitudes).

### Agregado (Fase 7 — Compartir desde WhatsApp)
- La app aparece en el menú **Compartir** de Android (Web Share Target en el manifest). Pantalla `/compartir`: muestra el mensaje, quita el encabezado de WhatsApp ("[fecha] Nombre:"), y ofrece **Crear tarea**, **Crear reunión** (formularios precargados con el texto como descripción) o **Guardar como nota** (`communications`, canal `whatsapp`). Nada se guarda sin elegir una opción. Sin scraping ni acceso a WhatsApp.

### Agregado (Fase 6 — Dashboard e inteligencia de productividad)
- **Dashboard** (`/dashboard`): tareas abiertas, vencidas, que vencen esta semana, % terminadas a tiempo; barras de tareas terminadas, nuevas y horas en reuniones por semana (6 semanas, con vista de tabla); matriz urgente/importante; recomendaciones por reglas explícitas (`src/lib/metrics.ts`).
- **Análisis de problemas** (`/dashboard/incidencias`): registrar un problema, hechos, 5 porqués, Ishikawa (6M), causa raíz, recomendaciones y plan de acción (contención, correctiva, preventiva) con responsable, fecha y avance. Indica qué falta para un análisis completo.
- Sin nuevas dependencias (gráficas en HTML/CSS) y sin migración (tablas `incidents` y `solutions` de la Fase 0).

### Agregado (Fase 5 — Podcast)
- **Podcast** (`/podcast`): guion del resumen de la mañana o del cierre del día, leído con la voz del propio equipo (síntesis de voz del navegador: sin servicio externo ni costo). Reproducir, pausa, párrafo anterior/siguiente, velocidad. Historial de los últimos 7 días (se arma con los datos de ese día).

### Agregado (Fase 4 — Automatizaciones sin servidor externo)
- **Resumen de la mañana y cierre del día** (`/resumen` y tarjeta en Inicio): reuniones, prioridades (urgente+importante primero), tiempo libre, alertas (vencidas, día cargado, reuniones empalmadas), terminadas hoy, pendientes y lo de mañana. Cambia a cierre después de `day_close_time` (16:45).
- Cierre: botón **Pasar pendientes a mañana** (con confirmación) que recorre fecha y recordatorios a la misma hora.
- **Alertas** en Inicio: recordatorios que ya llegaron (botón "Listo"), reuniones que empiezan en 15 min y tareas vencidas; una llave por origen evita duplicados.
- **Avisos de recordatorios** en el equipo mientras la app está abierta o en segundo plano (Configuración → Avisos → Activar). Al tocar el aviso se abre la tarea o reunión. Service worker `v5`.
- Pendiente: avisos con la app cerrada (Web Push + tarea programada en servidor) y n8n; requieren servicios externos.

### Agregado (Fase 2 — Asistente con inteligencia artificial)
- Pantalla **Asistente** (`/inteligencia`): conversación con Claude (Claude API, modelo `claude-opus-5-5` por omisión) con historial de conversaciones.
- El asistente consulta datos reales con herramientas: agenda de un rango de fechas, búsqueda de tareas (abiertas, cerradas, vencidas) y memoria.
- Acciones autorizadas: el asistente solo **propone** crear una tarea, agendar una reunión, marcar una tarea como terminada o guardar algo en memoria. Cada propuesta aparece con botones **Confirmar / Descartar**; nada se ejecuta sin tu confirmación.
- Memoria estructurada (`/inteligencia/memoria`): lo que el asistente sabe de ti, por categoría, con botón "Olvidar".
- Migración `20261103000004_assistant.sql`: `assistant_conversations`, `assistant_messages` (solo se agregan, no se editan) y `assistant_actions` (lista blanca de acciones; estado pendiente/confirmada/descartada/fallida, con auditoría).
- Nueva dependencia: `@anthropic-ai/sdk` (SDK oficial de Anthropic), solo en el servidor.

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
