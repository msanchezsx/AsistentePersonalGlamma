-- Reuniones críticas (Fase 1, pedido del usuario 2026-11-04): muestran un
-- aviso a pantalla completa con "Enterado", "Ya lo realicé" y "Cancelar".
-- Las tareas críticas no necesitan columna: prioridad 1 (Crítica) o
-- urgente + importante.
alter table public.meetings
  add column if not exists is_critical boolean not null default false;
