# Base de datos

PostgreSQL en Supabase. Migraciones en `supabase/migrations/` (se aplican en orden):

| Archivo | Contenido |
|---|---|
| `20261103000001_initial_schema.sql` | Esquema inicial (Fase 0) |
| `20261103000002_tasks_all_day.sql` | `tasks.due_all_day`: fecha límite sin hora (Fase 1.1) |
| `20261103000003_recurrences.sql` | `recurrence_rules.applies_to` (task/meeting), `recurrence_rules.reminder_minutes` e índices únicos `(recurrence_rule_id, starts_at)` en meetings y `(recurrence_rule_id, due_at)` en tasks (Fase 1.3) |
| `20261103000004_assistant.sql` | Asistente: `assistant_conversations`, `assistant_messages` (solo inserción), `assistant_actions` (propuestas con confirmación) (Fase 2) |
| `20261104000005_meetings_critical.sql` | `meetings.is_critical`: reunión crítica con aviso a pantalla completa |

## Convenciones

- Llave primaria `id uuid` (`gen_random_uuid()`), salvo tablas 1:1 por usuario (llave = `user_id`) y `audit_log` (`bigint identity`).
- Toda tabla tiene `user_id` → `auth.users(id) on delete cascade` y está protegida por RLS.
- Relaciones con **llaves foráneas compuestas** `(x_id, user_id)` → `tabla(id, user_id)`, de modo que una fila solo puede apuntar a filas del mismo usuario. Para `on delete set null` se usa `set null (columna)` (PostgreSQL 15+).
- `created_at` y `updated_at` en todas las tablas; `updated_at` se actualiza por trigger.
- Estados con `text` + `CHECK`. Longitudes máximas en todos los textos.
- Historial: trigger `app.audit_row_change` guarda `old_data`/`new_data` en `audit_log` para las entidades de negocio y de seguridad.
- Zona horaria por defecto `America/Mexico_City`; fechas con hora en `timestamptz`.

## Entidades

| Entidad (spec) | Tabla | Notas |
|---|---|---|
| Usuarios | `profiles` | 1:1 con `auth.users`; se crea por trigger al invitar al usuario. |
| Dispositivos | `devices` | Hash SHA-256 del token; estados `pending`/`active`/`revoked`. Solo lectura vía API; cambios con funciones RPC. |
| Perfil profesional | `professional_profiles` | Puesto, área, responsabilidades, objetivos, tareas frecuentes. |
| Preferencias | `user_preferences` | Jornada L-V 9:00–17:00, horas de resumen/cierre, anticipación de recordatorios, horas de silencio, máximo de dispositivos (2). |
| Clientes | `clients` | Nombre único por usuario (sin distinguir mayúsculas). |
| Contactos | `contacts` | Relación: jefe, equipo, cliente, proveedor, colega. Correo único por usuario. |
| Proyectos | `projects` | `code` para número de pedido (p. ej. 103050). |
| Recurrencias | `recurrence_rules` | RRULE (RFC 5545) + zona horaria, `applies_to` (task/meeting), `reminder_minutes`, `until_date`. Tareas: una repetición abierta a la vez, la siguiente se crea al cerrar. Reuniones: se generan 60 días adelante. |
| Reuniones | `meetings`, `meeting_participants` | `draft` hasta confirmar; `external_provider/id` únicos para sincronizar calendario sin duplicar. |
| Tareas | `tasks` | `due_all_day` = fecha sin hora (se guarda 23:59:59 local). Prioridad 1–5, urgente/importante (Eisenhower), `completion_confirmed`, `source`. `done` ⇔ `completed_at`. |
| Comunicaciones | `communications` | Supertipo: correo, WhatsApp compartido, llamada, nota. Solo resumen, no cuerpo completo. |
| Correos | `emails` | Extensión 1:1 de `communications` con datos de Graph; `graph_message_id` único por usuario. |
| Seguimientos / compromisos | `follow_ups` | `kind` follow_up/commitment; `owner_side` mine/theirs; ligado a tarea, reunión, comunicación, cliente o proyecto. |
| Recordatorios | `reminders` | Un destino (tarea, reunión o seguimiento) o un título libre. |
| Notificaciones | `notifications` | `unique (user_id, dedupe_key)` evita duplicados. Las crea el servidor; el usuario solo lee/marca. |
| — | `push_subscriptions` | Web Push por dispositivo; se borran al revocarlo. |
| Incidencias | `incidents` | `analysis` jsonb (ver abajo). |
| Soluciones | `solutions` | Correctivas, preventivas, contención; responsable, fechas, métrica, resultado. |
| Resúmenes diarios | `daily_summaries` | Uno por día y tipo (`morning`/`closing`); `sources` registra qué se consultó y qué falló. |
| Podcasts | `podcasts` | Uno por día; audio en Storage privado. |
| Auditoría | `audit_log` | Inmutable vía API. Sin FK a usuarios a propósito (los triggers escriben durante el borrado en cascada). |
| Conversaciones del asistente | `assistant_conversations`, `assistant_messages` | Los mensajes guardan el contenido completo de la API (`content` jsonb) y el texto visible (`display_text`). Sin `update`: el historial solo crece. Se borran en cascada con la conversación. |
| Acciones propuestas | `assistant_actions` | `kind` en lista blanca (`create_task`, `create_meeting`, `complete_task`, `remember`); `status` pending → confirmed/rejected/failed; `result_id` del registro creado. Auditada. |
| Memoria del asistente | `assistant_memory` | `confirmed` distingue hechos de inferencias; las correcciones crean un registro nuevo y el anterior apunta con `superseded_by`. |

### Formato de `incidents.analysis`

```json
{
  "facts": ["..."],
  "hypotheses": ["..."],
  "five_whys": [{ "why": "...", "answer": "..." }],
  "ishikawa": { "metodo": [], "mano_de_obra": [], "maquinaria": [], "materiales": [], "medicion": [], "medio_ambiente": [] },
  "root_causes": ["..."],
  "risks": [{ "risk": "...", "impact": "low|medium|high" }],
  "recommendations": ["..."]
}
```

## Políticas RLS

| Tablas | Permisos del usuario autenticado |
|---|---|
| clients, contacts, projects, recurrence_rules, meetings, meeting_participants, tasks, communications, emails, follow_ups, reminders, incidents, solutions, assistant_memory | CRUD solo de sus filas (`user_id = auth.uid()`) |
| profiles, professional_profiles, user_preferences | Leer y actualizar la propia fila |
| notifications | Leer y actualizar (marcar leída) |
| daily_summaries, podcasts, audit_log, devices | Solo lectura |
| push_subscriptions | Leer y borrar |
| (rol `anon`) | Sin acceso a ninguna tabla ni función |

`force row level security` está activo en todas las tablas.

## Funciones RPC

| Función | Uso |
|---|---|
| `device_status(token_hash)` | Estado del dispositivo actual (usado por el middleware). |
| `register_device(token_hash, name, platform)` | Primer dispositivo → `active`; siguientes → `pending`. Idempotente. |
| `approve_device(device_id, caller_token_hash)` | Solo desde un dispositivo activo; respeta `max_devices`. |
| `revoke_device(device_id, caller_token_hash)` | Revoca y borra sus suscripciones push. |

## Pruebas

`npm run db:test` crea una base desechable, simula `auth.users`/`auth.uid()` y los roles de Supabase, aplica las migraciones y ejecuta `supabase/tests/rls_test.sql` (33 comprobaciones: aislamiento entre usuarios, FK cruzadas, auditoría, anon, restricciones, deduplicación, dispositivos, borrado en cascada).
