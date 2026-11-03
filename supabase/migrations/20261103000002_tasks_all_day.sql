-- =====================================================================
-- Fase 1.1 — Tareas
-- Permite registrar tareas con fecha límite sin hora ("todo el día").
-- Cuando due_all_day = true, due_at guarda el final de ese día en la zona
-- horaria del usuario (23:59:59) para que el orden y los vencimientos sean
-- correctos, y la interfaz muestra solo la fecha.
-- =====================================================================

alter table public.tasks
  add column if not exists due_all_day boolean not null default false;

alter table public.tasks
  drop constraint if exists tasks_due_all_day_requires_due_at;
alter table public.tasks
  add constraint tasks_due_all_day_requires_due_at check (not due_all_day or due_at is not null);
