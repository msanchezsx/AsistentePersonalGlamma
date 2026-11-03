-- =====================================================================
-- Fase 2 — Asistente conversacional
-- * assistant_conversations: hilos de conversación.
-- * assistant_messages: mensajes tal como se envían a Claude (jsonb). Solo
--   se agregan: nunca se editan, para conservar el historial exacto.
-- * assistant_actions: acciones que el asistente PROPONE (crear tarea,
--   reunión, completar, recordar). Solo se ejecutan cuando el usuario las
--   confirma en la app.
-- =====================================================================

create table if not exists public.assistant_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'Conversación' check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index if not exists assistant_conversations_user_updated_idx
  on public.assistant_conversations (user_id, updated_at desc);

create table if not exists public.assistant_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  role            text not null check (role in ('user', 'assistant')),
  -- Contenido en formato de la API de Claude (texto, tool_use, tool_result, thinking).
  content         jsonb not null,
  -- Texto visible para la interfaz (vacío en mensajes que solo llevan resultados de herramientas).
  display_text    text not null default '' check (char_length(display_text) <= 20000),
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.assistant_conversations (id, user_id) on delete cascade
);
create index if not exists assistant_messages_conv_created_idx
  on public.assistant_messages (conversation_id, created_at);

create table if not exists public.assistant_actions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  kind            text not null check (kind in ('create_task', 'create_meeting', 'complete_task', 'remember')),
  payload         jsonb not null,
  summary         text not null check (char_length(summary) between 1 and 500),
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'rejected', 'failed')),
  result_id       uuid,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.assistant_conversations (id, user_id) on delete cascade
);
create index if not exists assistant_actions_user_status_idx
  on public.assistant_actions (user_id, status, created_at desc);

-- updated_at y auditoría (los mensajes no se auditan: son el propio historial)
create trigger set_updated_at before update on public.assistant_conversations
  for each row execute function app.set_updated_at();
create trigger set_updated_at before update on public.assistant_actions
  for each row execute function app.set_updated_at();
create trigger audit_changes after insert or update or delete on public.assistant_actions
  for each row execute function app.audit_row_change();

-- RLS: cada usuario solo ve lo suyo
alter table public.assistant_conversations enable row level security;
alter table public.assistant_conversations force row level security;
create policy owner_all on public.assistant_conversations for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.assistant_messages enable row level security;
alter table public.assistant_messages force row level security;
create policy owner_select on public.assistant_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy owner_insert on public.assistant_messages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy owner_delete on public.assistant_messages for delete to authenticated
  using (user_id = (select auth.uid()));

alter table public.assistant_actions enable row level security;
alter table public.assistant_actions force row level security;
create policy owner_all on public.assistant_actions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.assistant_conversations, public.assistant_messages, public.assistant_actions from anon;
grant select, insert, update, delete on public.assistant_conversations, public.assistant_actions to authenticated;
grant select, insert, delete on public.assistant_messages to authenticated;
-- Mensajes: solo se agregan (nunca se editan).
revoke update, truncate on public.assistant_messages from authenticated;
