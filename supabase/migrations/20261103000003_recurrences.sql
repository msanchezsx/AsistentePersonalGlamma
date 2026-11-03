-- =====================================================================
-- Fase 1.3 — Actividades recurrentes
-- * applies_to: la regla es de tareas o de reuniones.
-- * reminder_minutes: anticipación del recordatorio para cada repetición.
-- * Índices únicos para que una misma repetición nunca se genere dos veces.
-- =====================================================================

alter table public.recurrence_rules
  add column if not exists applies_to text not null default 'task';
alter table public.recurrence_rules
  drop constraint if exists recurrence_rules_applies_to_check;
alter table public.recurrence_rules
  add constraint recurrence_rules_applies_to_check check (applies_to in ('task', 'meeting'));

alter table public.recurrence_rules
  add column if not exists reminder_minutes integer;
alter table public.recurrence_rules
  drop constraint if exists recurrence_rules_reminder_minutes_check;
alter table public.recurrence_rules
  add constraint recurrence_rules_reminder_minutes_check
  check (reminder_minutes is null or reminder_minutes between 0 and 10080);

create unique index if not exists meetings_recurrence_occurrence_uq
  on public.meetings (recurrence_rule_id, starts_at) where recurrence_rule_id is not null;
create unique index if not exists tasks_recurrence_occurrence_uq
  on public.tasks (recurrence_rule_id, due_at) where recurrence_rule_id is not null;
create index if not exists recurrence_rules_user_applies_idx
  on public.recurrence_rules (user_id, applies_to);
