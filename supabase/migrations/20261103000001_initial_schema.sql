-- =====================================================================
-- Asistente Ejecutivo Personal — Esquema inicial (Fase 0)
-- PostgreSQL 15+ / Supabase
--
-- Principios:
--   * Toda fila pertenece a un usuario (user_id) y está protegida por RLS.
--   * Las relaciones entre tablas usan llaves foráneas compuestas (id, user_id)
--     para impedir que un usuario relacione sus datos con filas de otro.
--   * created_at / updated_at en todas las tablas; updated_at por trigger.
--   * Historial de cambios en audit_log mediante triggers (old/new en jsonb).
--   * Estados como text + CHECK para poder evolucionarlos sin migraciones
--     costosas de tipos enum.
-- =====================================================================

create extension if not exists pgcrypto;

create schema if not exists app;
comment on schema app is 'Funciones internas de la aplicación (no expuestas por la API).';

-- ---------------------------------------------------------------------
-- Funciones utilitarias
-- ---------------------------------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Registro de auditoría genérico. Se ejecuta con privilegios del dueño para
-- poder escribir en audit_log aunque el usuario no tenga permiso de INSERT.
create or replace function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_user := (v_old ->> 'user_id')::uuid;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_user := (v_new ->> 'user_id')::uuid;
    -- No registrar actualizaciones que solo cambian updated_at.
    if (v_old - 'updated_at') = (v_new - 'updated_at') then
      return new;
    end if;
  else
    v_new := to_jsonb(new);
    v_user := (v_new ->> 'user_id')::uuid;
  end if;

  -- profiles usa id como user_id.
  if v_user is null and tg_table_name = 'profiles' then
    v_user := coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid);
  end if;

  insert into public.audit_log (user_id, actor_id, action, entity_table, entity_id, old_data, new_data)
  values (
    v_user,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid,
             (v_new ->> 'communication_id')::uuid, (v_old ->> 'communication_id')::uuid),
    v_old,
    v_new
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- USUARIOS: profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text check (char_length(full_name) <= 120),
  preferred_name text check (char_length(preferred_name) <= 60),
  timezone      text not null default 'America/Mexico_City',
  locale        text not null default 'es-MX',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'Usuario de la aplicación (datos básicos, 1:1 con auth.users).';

-- Crea automáticamente el perfil y las preferencias al registrar un usuario.
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.professional_profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- DISPOSITIVOS autorizados
-- ---------------------------------------------------------------------

create table public.devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 (hex) del token aleatorio guardado en una cookie httpOnly.
  -- El token en claro nunca se almacena.
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  name          text not null check (char_length(name) between 1 and 80),
  platform      text check (char_length(platform) <= 40),
  status        text not null default 'pending'
                check (status in ('pending', 'active', 'revoked')),
  approved_at   timestamptz,
  revoked_at    timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id)
);
create index devices_user_status_idx on public.devices (user_id, status);
comment on table public.devices is 'Dispositivos (celular, tablet) autorizados para acceder a la cuenta.';

-- ---------------------------------------------------------------------
-- PERFIL PROFESIONAL y PREFERENCIAS
-- ---------------------------------------------------------------------

create table public.professional_profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  position         text check (char_length(position) <= 120),
  area             text check (char_length(area) <= 120),
  company          text check (char_length(company) <= 120),
  responsibilities text[] not null default '{}',
  main_activities  text[] not null default '{}',
  objectives       text[] not null default '{}',
  frequent_tasks   text[] not null default '{}',
  work_style_notes text check (char_length(work_style_notes) <= 2000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.professional_profiles is 'Perfil profesional construido progresivamente (editable por el usuario).';

create table public.user_preferences (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  -- 1 = lunes ... 7 = domingo (ISO 8601)
  work_days                smallint[] not null default '{1,2,3,4,5}'
                           check (work_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  work_start               time not null default '09:00',
  work_end                 time not null default '17:00',
  daily_summary_time       time not null default '08:45',
  day_close_time           time not null default '16:45',
  default_reminder_minutes integer not null default 15
                           check (default_reminder_minutes between 0 and 10080),
  quiet_hours_start        time default '21:00',
  quiet_hours_end          time default '07:00',
  podcast_enabled          boolean not null default false,
  podcast_target_minutes   smallint not null default 7 check (podcast_target_minutes between 5 and 10),
  max_devices              smallint not null default 2 check (max_devices between 1 and 5),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (work_end > work_start)
);
comment on table public.user_preferences is 'Preferencias de jornada, notificaciones y dispositivos.';

-- ---------------------------------------------------------------------
-- CLIENTES, CONTACTOS, PROYECTOS
-- ---------------------------------------------------------------------

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 160),
  code        text check (char_length(code) <= 40),
  notes       text check (char_length(notes) <= 4000),
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create unique index clients_user_name_uq on public.clients (user_id, lower(name));

create table public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  client_id   uuid,
  full_name   text not null check (char_length(full_name) between 1 and 160),
  role        text check (char_length(role) <= 120),
  relationship text not null default 'other'
              check (relationship in ('boss', 'team', 'client', 'supplier', 'colleague', 'other')),
  email       text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (char_length(phone) <= 30),
  notes       text check (char_length(notes) <= 4000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id)
);
create index contacts_user_client_idx on public.contacts (user_id, client_id);
create unique index contacts_user_email_uq on public.contacts (user_id, lower(email)) where email is not null;

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  client_id   uuid,
  name        text not null check (char_length(name) between 1 and 160),
  code        text check (char_length(code) <= 40), -- p. ej. número de pedido
  description text check (char_length(description) <= 4000),
  status      text not null default 'active'
              check (status in ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
  start_date  date,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index projects_user_status_idx on public.projects (user_id, status);
create index projects_user_client_idx on public.projects (user_id, client_id);

-- ---------------------------------------------------------------------
-- RECURRENCIAS
-- ---------------------------------------------------------------------

create table public.recurrence_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Regla en formato iCalendar RRULE (RFC 5545), p. ej. FREQ=WEEKLY;BYDAY=MO
  rrule       text not null check (rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$'),
  timezone    text not null default 'America/Mexico_City',
  starts_on   date not null,
  until_date  date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  check (until_date is null or until_date >= starts_on)
);

-- ---------------------------------------------------------------------
-- REUNIONES
-- ---------------------------------------------------------------------

create table public.meetings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  project_id         uuid,
  client_id          uuid,
  recurrence_rule_id uuid,
  title              text not null check (char_length(title) between 1 and 200),
  description        text check (char_length(description) <= 4000),
  location           text check (char_length(location) <= 300),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             text not null default 'scheduled'
                     check (status in ('draft', 'scheduled', 'held', 'cancelled', 'missed')),
  -- Las reuniones creadas por el asistente quedan en 'draft' hasta confirmarse.
  source             text not null default 'manual'
                     check (source in ('manual', 'voice', 'assistant', 'email', 'whatsapp', 'calendar_sync')),
  external_provider  text check (char_length(external_provider) <= 40),
  external_id        text check (char_length(external_id) <= 300),
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),
  check (ends_at > starts_at),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  foreign key (recurrence_rule_id, user_id) references public.recurrence_rules (id, user_id) on delete set null (recurrence_rule_id)
);
create index meetings_user_starts_idx on public.meetings (user_id, starts_at);
create index meetings_user_project_idx on public.meetings (user_id, project_id);
create unique index meetings_external_uq on public.meetings (user_id, external_provider, external_id)
  where external_id is not null;

create table public.meeting_participants (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  meeting_id  uuid not null,
  contact_id  uuid,
  -- Si el participante aún no es contacto, se guarda solo su nombre.
  display_name text check (char_length(display_name) <= 160),
  response    text not null default 'unknown'
              check (response in ('unknown', 'accepted', 'declined', 'tentative')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (meeting_id, user_id) references public.meetings (id, user_id) on delete cascade,
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete cascade,
  check (contact_id is not null or display_name is not null)
);
create index meeting_participants_meeting_idx on public.meeting_participants (meeting_id);
create unique index meeting_participants_contact_uq on public.meeting_participants (meeting_id, contact_id)
  where contact_id is not null;

-- ---------------------------------------------------------------------
-- TAREAS
-- ---------------------------------------------------------------------

create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  project_id         uuid,
  client_id          uuid,
  meeting_id         uuid,
  recurrence_rule_id uuid,
  title              text not null check (char_length(title) between 1 and 300),
  description        text check (char_length(description) <= 4000),
  status             text not null default 'pending'
                     check (status in ('pending', 'in_progress', 'waiting', 'done', 'cancelled')),
  priority           smallint not null default 3 check (priority between 1 and 5), -- 1 = máxima
  is_urgent          boolean not null default false,
  is_important       boolean not null default false,
  due_at             timestamptz,
  completed_at       timestamptz,
  -- El asistente nunca marca 'done' sin confirmación: completion_confirmed
  -- distingue lo confirmado por el usuario de lo inferido.
  completion_confirmed boolean not null default false,
  source             text not null default 'manual'
                     check (source in ('manual', 'voice', 'assistant', 'email', 'whatsapp', 'recurrence')),
  source_ref         text check (char_length(source_ref) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (id, user_id),
  check ((status = 'done') = (completed_at is not null)),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  foreign key (meeting_id, user_id) references public.meetings (id, user_id) on delete set null (meeting_id),
  foreign key (recurrence_rule_id, user_id) references public.recurrence_rules (id, user_id) on delete set null (recurrence_rule_id)
);
create index tasks_user_status_due_idx on public.tasks (user_id, status, due_at);
create index tasks_user_project_idx on public.tasks (user_id, project_id);
create index tasks_user_completed_idx on public.tasks (user_id, completed_at) where completed_at is not null;

-- ---------------------------------------------------------------------
-- COMUNICACIONES y CORREOS
-- ---------------------------------------------------------------------

-- Supertipo para cualquier comunicación (correo, WhatsApp compartido, llamada, nota).
create table public.communications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  channel      text not null check (channel in ('email', 'whatsapp', 'call', 'note', 'other')),
  direction    text not null default 'inbound' check (direction in ('inbound', 'outbound', 'internal')),
  contact_id   uuid,
  client_id    uuid,
  project_id   uuid,
  subject      text check (char_length(subject) <= 500),
  -- Resumen generado / texto compartido. No se guarda el cuerpo completo de
  -- correos por defecto (minimización de datos).
  summary      text check (char_length(summary) <= 8000),
  occurred_at  timestamptz not null,
  needs_attention boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete set null (contact_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);
create index communications_user_occurred_idx on public.communications (user_id, occurred_at desc);
create index communications_user_attention_idx on public.communications (user_id) where needs_attention;

-- Extensión 1:1 de communications con los datos propios de Outlook / Graph.
create table public.emails (
  communication_id uuid primary key,
  user_id          uuid not null references auth.users (id) on delete cascade,
  graph_message_id text not null check (char_length(graph_message_id) <= 300),
  conversation_id  text check (char_length(conversation_id) <= 300),
  from_address     text check (char_length(from_address) <= 320),
  from_name        text check (char_length(from_name) <= 200),
  received_at      timestamptz not null,
  importance       text check (importance in ('low', 'normal', 'high')),
  category         text check (category in ('action_required', 'fyi', 'meeting', 'commitment', 'newsletter', 'other')),
  is_read          boolean,
  web_link         text check (char_length(web_link) <= 2000),
  draft_reply      text check (char_length(draft_reply) <= 8000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (communication_id, user_id) references public.communications (id, user_id) on delete cascade,
  unique (user_id, graph_message_id)
);
create index emails_user_received_idx on public.emails (user_id, received_at desc);

-- ---------------------------------------------------------------------
-- SEGUIMIENTOS y COMPROMISOS
-- ---------------------------------------------------------------------

create table public.follow_ups (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  kind             text not null default 'follow_up' check (kind in ('follow_up', 'commitment')),
  -- mine: yo me comprometí; theirs: otra persona se comprometió conmigo.
  owner_side       text not null default 'mine' check (owner_side in ('mine', 'theirs')),
  title            text not null check (char_length(title) between 1 and 300),
  description      text check (char_length(description) <= 4000),
  status           text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  due_at           timestamptz,
  closed_at        timestamptz,
  contact_id       uuid,
  client_id        uuid,
  project_id       uuid,
  task_id          uuid,
  meeting_id       uuid,
  communication_id uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  check ((status = 'open') = (closed_at is null)),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete set null (contact_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete set null (task_id),
  foreign key (meeting_id, user_id) references public.meetings (id, user_id) on delete set null (meeting_id),
  foreign key (communication_id, user_id) references public.communications (id, user_id) on delete set null (communication_id)
);
create index follow_ups_user_status_due_idx on public.follow_ups (user_id, status, due_at);
create index follow_ups_user_client_idx on public.follow_ups (user_id, client_id);

-- ---------------------------------------------------------------------
-- RECORDATORIOS y NOTIFICACIONES
-- ---------------------------------------------------------------------

create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  task_id      uuid,
  meeting_id   uuid,
  follow_up_id uuid,
  title        text check (char_length(title) <= 300), -- recordatorio libre
  remind_at    timestamptz not null,
  repeat_every_minutes integer check (repeat_every_minutes between 5 and 10080),
  status       text not null default 'scheduled' check (status in ('scheduled', 'sent', 'dismissed', 'cancelled')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  -- Exactamente un destino, o un título libre.
  check (num_nonnulls(task_id, meeting_id, follow_up_id) <= 1),
  check (num_nonnulls(task_id, meeting_id, follow_up_id) = 1 or title is not null),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (meeting_id, user_id) references public.meetings (id, user_id) on delete cascade,
  foreign key (follow_up_id, user_id) references public.follow_ups (id, user_id) on delete cascade
);
create index reminders_due_idx on public.reminders (remind_at) where status = 'scheduled';
create index reminders_user_idx on public.reminders (user_id, remind_at);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  reminder_id   uuid,
  kind          text not null check (kind in ('reminder', 'meeting', 'overdue', 'follow_up', 'commitment',
                                              'daily_summary', 'day_close', 'podcast', 'alert', 'security')),
  title         text not null check (char_length(title) between 1 and 200),
  body          text check (char_length(body) <= 1000),
  url           text check (url like '/%' and char_length(url) <= 500), -- solo rutas internas
  -- Llave de deduplicación: la misma alerta no se genera dos veces.
  dedupe_key    text not null check (char_length(dedupe_key) between 1 and 300),
  scheduled_for timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'read', 'dismissed')),
  sent_at       timestamptz,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, dedupe_key),
  foreign key (reminder_id, user_id) references public.reminders (id, user_id) on delete set null (reminder_id)
);
create index notifications_pending_idx on public.notifications (scheduled_for) where status = 'pending';
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Suscripciones Web Push ligadas a un dispositivo: al revocar el dispositivo
-- se eliminan sus suscripciones.
create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  device_id   uuid not null,
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth_key    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  foreign key (device_id, user_id) references public.devices (id, user_id) on delete cascade
);
create index push_subscriptions_device_idx on public.push_subscriptions (device_id);

-- ---------------------------------------------------------------------
-- INCIDENCIAS y SOLUCIONES (análisis de problemas)
-- ---------------------------------------------------------------------

create table public.incidents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  client_id   uuid,
  project_id  uuid,
  title       text not null check (char_length(title) between 1 and 300),
  description text check (char_length(description) <= 8000),
  severity    text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status      text not null default 'open' check (status in ('open', 'analyzing', 'action_plan', 'monitoring', 'closed')),
  -- Análisis estructurado. Formato documentado en DATABASE.md:
  -- { facts: [], hypotheses: [], five_whys: [], ishikawa: {...}, root_causes: [], risks: [] }
  analysis    jsonb not null default '{}'::jsonb check (jsonb_typeof(analysis) = 'object'),
  occurred_at timestamptz,
  closed_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id)
);
create index incidents_user_status_idx on public.incidents (user_id, status);

create table public.solutions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  incident_id   uuid not null,
  action_type   text not null check (action_type in ('corrective', 'preventive', 'containment')),
  description   text not null check (char_length(description) between 1 and 4000),
  owner_contact_id uuid,
  owner_name    text check (char_length(owner_name) <= 160),
  due_date      date,
  follow_up_date date,
  status        text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  success_metric text check (char_length(success_metric) <= 1000),
  result        text check (char_length(result) <= 4000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (incident_id, user_id) references public.incidents (id, user_id) on delete cascade,
  foreign key (owner_contact_id, user_id) references public.contacts (id, user_id) on delete set null (owner_contact_id)
);
create index solutions_incident_idx on public.solutions (incident_id);

-- ---------------------------------------------------------------------
-- RESÚMENES DIARIOS y PODCASTS
-- ---------------------------------------------------------------------

create table public.daily_summaries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  summary_date  date not null,
  kind          text not null check (kind in ('morning', 'closing')),
  content       jsonb not null check (jsonb_typeof(content) = 'object'),
  -- Fuentes consultadas y cuáles fallaron, para no presentar datos no verificados.
  sources       jsonb not null default '{}'::jsonb,
  generated_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, summary_date, kind)
);

create table public.podcasts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  daily_summary_id uuid,
  podcast_date     date not null,
  script           text check (char_length(script) <= 30000),
  audio_path       text check (char_length(audio_path) <= 500), -- ruta en Supabase Storage (bucket privado)
  duration_seconds integer check (duration_seconds between 0 and 1800),
  status           text not null default 'pending' check (status in ('pending', 'scripting', 'synthesizing', 'ready', 'failed')),
  error_message    text check (char_length(error_message) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, podcast_date),
  foreign key (daily_summary_id, user_id) references public.daily_summaries (id, user_id) on delete set null (daily_summary_id)
);

-- ---------------------------------------------------------------------
-- MEMORIA DEL ASISTENTE
-- ---------------------------------------------------------------------

create table public.assistant_memory (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  category     text not null check (category in ('profile', 'preference', 'habit', 'priority', 'process',
                                                 'decision', 'relationship', 'project', 'client', 'other')),
  subject      text not null check (char_length(subject) between 1 and 200),
  content      text not null check (char_length(content) between 1 and 4000),
  source       text not null default 'user' check (source in ('user', 'conversation', 'email', 'whatsapp', 'inferred')),
  -- Lo inferido nunca se trata como hecho hasta que el usuario lo confirma.
  confirmed    boolean not null default false,
  confidence   numeric(3,2) check (confidence between 0 and 1),
  client_id    uuid,
  project_id   uuid,
  contact_id   uuid,
  -- Al corregir un recuerdo se crea uno nuevo y el anterior apunta a él.
  superseded_by uuid,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  foreign key (client_id, user_id) references public.clients (id, user_id) on delete set null (client_id),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete set null (project_id),
  foreign key (contact_id, user_id) references public.contacts (id, user_id) on delete set null (contact_id),
  foreign key (superseded_by, user_id) references public.assistant_memory (id, user_id) on delete set null (superseded_by)
);
create index assistant_memory_user_cat_idx on public.assistant_memory (user_id, category) where is_active;

-- ---------------------------------------------------------------------
-- AUDITORÍA
-- ---------------------------------------------------------------------

create table public.audit_log (
  id           bigint generated always as identity primary key,
  -- Sin llave foránea a propósito: los triggers de auditoría escriben aquí
  -- durante el borrado en cascada de un usuario (la limpieza se hace aparte).
  user_id      uuid,
  actor_id     uuid, -- auth.uid() de quien ejecutó el cambio (null = sistema / service role)
  action       text not null check (action in ('insert', 'update', 'delete', 'login', 'logout',
                                                'device_registered', 'device_approved', 'device_revoked', 'other')),
  entity_table text,
  entity_id    uuid,
  old_data     jsonb,
  new_data     jsonb,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_user_created_idx on public.audit_log (user_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_table, entity_id);
comment on table public.audit_log is 'Historial inmutable de cambios y eventos de seguridad.';

-- ---------------------------------------------------------------------
-- Triggers: updated_at y auditoría
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'devices', 'professional_profiles', 'user_preferences', 'clients', 'contacts',
    'projects', 'recurrence_rules', 'meetings', 'meeting_participants', 'tasks', 'communications',
    'emails', 'follow_ups', 'reminders', 'notifications', 'push_subscriptions', 'incidents',
    'solutions', 'daily_summaries', 'podcasts', 'assistant_memory'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function app.set_updated_at()', t);
  end loop;

  -- Historial de cambios en las entidades de negocio y de seguridad.
  -- (notifications / push_subscriptions / daily_summaries / podcasts se
  -- excluyen por volumen: son datos derivados.)
  foreach t in array array[
    'profiles', 'devices', 'professional_profiles', 'user_preferences', 'clients', 'contacts',
    'projects', 'recurrence_rules', 'meetings', 'meeting_participants', 'tasks', 'communications',
    'emails', 'follow_ups', 'reminders', 'incidents', 'solutions', 'assistant_memory'
  ]
  loop
    execute format(
      'create trigger audit_changes after insert or update or delete on public.%I
         for each row execute function app.audit_row_change()', t);
  end loop;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- ---------------------------------------------------------------------
-- RLS: cada usuario solo ve y modifica su propia información
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  -- Tablas con CRUD completo para el dueño.
  foreach t in array array[
    'clients', 'contacts', 'projects', 'recurrence_rules', 'meetings', 'meeting_participants',
    'tasks', 'communications', 'emails', 'follow_ups', 'reminders', 'incidents', 'solutions',
    'assistant_memory'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;

  -- Tablas 1:1 por usuario: lectura y actualización (la fila la crea el trigger).
  foreach t in array array['professional_profiles', 'user_preferences']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy owner_select on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy owner_update on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;

  -- Datos generados por automatizaciones (service role): el usuario lee y
  -- puede marcar como leídos/descartados, pero no crearlos ni borrarlos.
  foreach t in array array['notifications', 'daily_summaries', 'podcasts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format(
      'create policy owner_select on public.%I for select to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

create policy owner_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- profiles
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy owner_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy owner_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- devices: solo lectura directa; altas/aprobaciones/revocaciones vía funciones.
alter table public.devices enable row level security;
alter table public.devices force row level security;
create policy owner_select on public.devices for select to authenticated
  using (user_id = (select auth.uid()));

-- push_subscriptions: el dueño puede borrar las suyas; el alta es vía servidor.
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
create policy owner_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- audit_log: solo lectura para el dueño; nadie puede modificarlo vía API.
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
create policy owner_select on public.audit_log for select to authenticated
  using (user_id = (select auth.uid()));

-- El rol anon no tiene acceso a ninguna tabla.
revoke all on all tables in schema public from anon;
revoke all on schema app from public, anon, authenticated;
-- No permitir modificar el registro de auditoría ni siquiera a authenticated.
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke insert, update, delete, truncate on public.devices from authenticated;

-- ---------------------------------------------------------------------
-- Funciones RPC de dispositivos (security definer, validan auth.uid())
-- ---------------------------------------------------------------------

-- Devuelve el estado del dispositivo actual o null si no existe.
create or replace function public.device_status(p_token_hash text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    return null;
  end if;
  select status into v_status
    from public.devices
   where token_hash = p_token_hash and user_id = auth.uid();
  return v_status;
end;
$$;

-- Registra el dispositivo actual. El primer dispositivo de la cuenta se
-- activa automáticamente; los siguientes quedan pendientes hasta que un
-- dispositivo activo los apruebe.
create or replace function public.register_device(p_token_hash text, p_name text, p_platform text default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_existing text;
  v_active_count int;
  v_status text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select status into v_existing from public.devices where token_hash = p_token_hash and user_id = v_uid;
  if v_existing is not null then
    update public.devices set last_seen_at = now() where token_hash = p_token_hash and user_id = v_uid;
    return v_existing;
  end if;

  -- Serializa registros simultáneos del mismo usuario.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select count(*) into v_active_count from public.devices where user_id = v_uid and status <> 'revoked';
  v_status := case when v_active_count = 0 then 'active' else 'pending' end;

  insert into public.devices (user_id, token_hash, name, platform, status, approved_at, last_seen_at)
  values (v_uid, p_token_hash, left(coalesce(nullif(trim(p_name), ''), 'Dispositivo'), 80), left(p_platform, 40),
          v_status, case when v_status = 'active' then now() end, now())
  returning id into v_id;

  insert into public.audit_log (user_id, actor_id, action, entity_table, entity_id, metadata)
  values (v_uid, v_uid, 'device_registered', 'devices', v_id, jsonb_build_object('status', v_status));

  return v_status;
end;
$$;

-- Aprueba un dispositivo pendiente. Solo puede hacerlo un dispositivo activo
-- y respetando el máximo de dispositivos configurado.
create or replace function public.approve_device(p_device_id uuid, p_caller_token_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_max int;
  v_active int;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not exists (select 1 from public.devices
                  where token_hash = p_caller_token_hash and user_id = v_uid and status = 'active') then
    raise exception 'caller device is not active' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select max_devices into v_max from public.user_preferences where user_id = v_uid;
  select count(*) into v_active from public.devices where user_id = v_uid and status = 'active';
  if v_active >= coalesce(v_max, 2) then
    raise exception 'device limit reached (%)', coalesce(v_max, 2) using errcode = 'P0001';
  end if;

  update public.devices
     set status = 'active', approved_at = now()
   where id = p_device_id and user_id = v_uid and status = 'pending';
  if not found then
    raise exception 'device not found or not pending' using errcode = 'P0002';
  end if;

  insert into public.audit_log (user_id, actor_id, action, entity_table, entity_id)
  values (v_uid, v_uid, 'device_approved', 'devices', p_device_id);
end;
$$;

-- Revoca un dispositivo (incluido el propio). Elimina sus suscripciones push.
create or replace function public.revoke_device(p_device_id uuid, p_caller_token_hash text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select id into v_caller_id from public.devices
   where token_hash = p_caller_token_hash and user_id = v_uid and status = 'active';
  if v_caller_id is null then
    raise exception 'caller device is not active' using errcode = '42501';
  end if;

  update public.devices
     set status = 'revoked', revoked_at = now()
   where id = p_device_id and user_id = v_uid and status <> 'revoked';
  if not found then
    raise exception 'device not found or already revoked' using errcode = 'P0002';
  end if;

  delete from public.push_subscriptions where device_id = p_device_id and user_id = v_uid;

  insert into public.audit_log (user_id, actor_id, action, entity_table, entity_id)
  values (v_uid, v_uid, 'device_revoked', 'devices', p_device_id);
end;
$$;

revoke all on function public.device_status(text) from public, anon;
revoke all on function public.register_device(text, text, text) from public, anon;
revoke all on function public.approve_device(uuid, text) from public, anon;
revoke all on function public.revoke_device(uuid, text) from public, anon;
grant execute on function public.device_status(text) to authenticated;
grant execute on function public.register_device(text, text, text) to authenticated;
grant execute on function public.approve_device(uuid, text) to authenticated;
grant execute on function public.revoke_device(uuid, text) to authenticated;
