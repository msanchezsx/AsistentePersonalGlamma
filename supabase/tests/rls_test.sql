-- Pruebas de esquema, RLS y funciones de dispositivos.
-- Ejecutar con: npm run db:test   (usa un PostgreSQL local desechable)
-- Todos los datos son ficticios.
\set ON_ERROR_STOP on
\set QUIET on

-- Usuarios ficticios
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'usuario.a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'usuario.b@example.com');

create or replace function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.check(p_ok boolean, p_msg text) returns void language plpgsql as $$
begin
  if not coalesce(p_ok, false) then raise exception 'FALLÓ: %', p_msg; end if;
  raise notice 'OK: %', p_msg;
end $$;

-- 1. Trigger de alta de usuario
select pg_temp.check((select count(*) from public.profiles) = 2, 'se crean perfiles al registrar usuarios');
select pg_temp.check((select count(*) from public.user_preferences where work_start = '09:00' and work_end = '17:00') = 2,
                     'preferencias por defecto con jornada 9:00-17:00');

-- 2. Usuario A crea datos
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.clients (id, user_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cliente Demo A');
insert into public.projects (id, user_id, client_id, name, code) values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Pedido de prueba', 'P-0001');
insert into public.tasks (user_id, project_id, title, due_at) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'Revisar pedido de prueba', now() + interval '1 day');
insert into public.meetings (user_id, project_id, title, starts_at, ends_at) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'Revisión con jefe',
   now() + interval '2 hours', now() + interval '3 hours');
select pg_temp.check((select count(*) from public.tasks) = 1, 'A ve su tarea');
reset role;

-- 3. Usuario B no ve ni modifica datos de A
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check((select count(*) from public.tasks) = 0, 'B no ve tareas de A');
select pg_temp.check((select count(*) from public.clients) = 0, 'B no ve clientes de A');
select pg_temp.check((select count(*) from public.profiles) = 1, 'B solo ve su propio perfil');
update public.tasks set title = 'hackeado';
delete from public.projects;
reset role;
select pg_temp.check((select count(*) from public.tasks where title = 'hackeado') = 0, 'B no puede modificar tareas de A');
select pg_temp.check((select count(*) from public.projects) = 1, 'B no puede borrar proyectos de A');

-- 4. B no puede insertar filas a nombre de A
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
do $$ begin
  insert into public.tasks (user_id, title) values ('11111111-1111-1111-1111-111111111111', 'suplantación');
  raise exception 'FALLÓ: B insertó una tarea a nombre de A';
exception when insufficient_privilege then raise notice 'OK: B no puede insertar a nombre de A';
end $$;

-- 5. B no puede relacionar su tarea con el proyecto de A (FK compuesta)
do $$ begin
  insert into public.tasks (user_id, project_id, title)
  values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'enlace cruzado');
  raise exception 'FALLÓ: B enlazó su tarea al proyecto de A';
exception when foreign_key_violation then raise notice 'OK: B no puede enlazar datos con proyectos de A';
end $$;

-- 6. Auditoría inmutable y privada
do $$ begin
  insert into public.audit_log (user_id, action) values ('22222222-2222-2222-2222-222222222222', 'other');
  raise exception 'FALLÓ: authenticated pudo escribir en audit_log';
exception when insufficient_privilege then raise notice 'OK: audit_log no admite escritura directa';
end $$;
select pg_temp.check((select count(*) from public.audit_log where user_id <> '22222222-2222-2222-2222-222222222222') = 0, 'B no ve la auditoría de A');
reset role;
select pg_temp.check((select count(*) from public.audit_log where user_id = '11111111-1111-1111-1111-111111111111'
                       and entity_table = 'tasks' and action = 'insert') = 1, 'se audita la creación de tareas');

-- 7. Rol anon sin acceso
set role anon;
do $$ begin
  perform 1 from public.tasks;
  raise exception 'FALLÓ: anon pudo leer tasks';
exception when insufficient_privilege then raise notice 'OK: anon no tiene acceso a tablas';
end $$;
do $$ begin
  perform public.register_device(repeat('a', 64), 'x');
  raise exception 'FALLÓ: anon pudo registrar dispositivo';
exception when insufficient_privilege then raise notice 'OK: anon no puede ejecutar funciones de dispositivos';
end $$;
reset role;

-- 8. Restricciones de integridad
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
do $$ begin
  insert into public.meetings (user_id, title, starts_at, ends_at)
  values ('11111111-1111-1111-1111-111111111111', 'mal', now(), now() - interval '1 hour');
  raise exception 'FALLÓ: reunión con fin antes del inicio';
exception when check_violation then raise notice 'OK: valida que la reunión termine después de iniciar';
end $$;
do $$ begin
  update public.tasks set status = 'done';
  raise exception 'FALLÓ: tarea done sin completed_at';
exception when check_violation then raise notice 'OK: una tarea terminada requiere fecha de cierre';
end $$;
do $$ begin
  insert into public.notifications (user_id, kind, title, dedupe_key)
  values ('11111111-1111-1111-1111-111111111111', 'alert', 'x', 'k');
  raise exception 'FALLÓ: el usuario creó una notificación directamente';
exception when insufficient_privilege then raise notice 'OK: las notificaciones solo las crea el servidor';
end $$;
reset role;

-- 9. Notificaciones sin duplicados (servidor / service role)
insert into public.notifications (user_id, kind, title, dedupe_key)
values ('11111111-1111-1111-1111-111111111111', 'meeting', 'Reunión en 15 min', 'meeting:abc:15');
do $$ begin
  insert into public.notifications (user_id, kind, title, dedupe_key)
  values ('11111111-1111-1111-1111-111111111111', 'meeting', 'Reunión en 15 min', 'meeting:abc:15');
  raise exception 'FALLÓ: notificación duplicada';
exception when unique_violation then raise notice 'OK: no se permiten notificaciones duplicadas';
end $$;

-- 10. Dispositivos: primer dispositivo activo, siguientes pendientes, límite y revocación
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.check(public.register_device(repeat('1', 64), 'Celular Android', 'android') = 'active',
                     'el primer dispositivo se activa automáticamente');
select pg_temp.check(public.register_device(repeat('1', 64), 'Celular Android', 'android') = 'active',
                     'registrar el mismo dispositivo es idempotente');
select pg_temp.check(public.register_device(repeat('2', 64), 'Tablet Android', 'android') = 'pending',
                     'el segundo dispositivo queda pendiente');
select pg_temp.check(public.register_device(repeat('3', 64), 'Equipo desconocido', null) = 'pending',
                     'un tercer dispositivo queda pendiente');
do $$ begin
  insert into public.devices (user_id, token_hash, name, status)
  values ('11111111-1111-1111-1111-111111111111', repeat('4', 64), 'auto-aprobado', 'active');
  raise exception 'FALLÓ: se insertó un dispositivo activo directamente';
exception when insufficient_privilege then raise notice 'OK: no se pueden crear dispositivos activos sin aprobación';
end $$;
do $$ begin
  perform public.approve_device((select id from public.devices where token_hash = repeat('3', 64)), repeat('2', 64));
  raise exception 'FALLÓ: un dispositivo pendiente aprobó a otro';
exception when insufficient_privilege then raise notice 'OK: solo un dispositivo activo puede aprobar';
end $$;
select public.approve_device((select id from public.devices where token_hash = repeat('2', 64)), repeat('1', 64));
select pg_temp.check(public.device_status(repeat('2', 64)) = 'active', 'la tablet se aprueba desde el celular');
do $$ begin
  perform public.approve_device((select id from public.devices where token_hash = repeat('3', 64)), repeat('1', 64));
  raise exception 'FALLÓ: se superó el máximo de dispositivos';
exception when raise_exception then raise notice 'OK: se respeta el máximo de 2 dispositivos';
end $$;
select public.revoke_device((select id from public.devices where token_hash = repeat('2', 64)), repeat('1', 64));
select pg_temp.check(public.device_status(repeat('2', 64)) = 'revoked', 'se puede revocar la tablet');
reset role;

select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.check(public.device_status(repeat('1', 64)) is null, 'B no puede consultar dispositivos de A');
select pg_temp.check((select count(*) from public.devices) = 0, 'B no ve dispositivos de A');
do $$ begin
  perform public.revoke_device((select id from public.devices limit 1), repeat('1', 64));
  raise exception 'FALLÓ: B revocó dispositivo de A';
exception when insufficient_privilege then raise notice 'OK: B no puede revocar dispositivos de A';
end $$;
reset role;
select pg_temp.check((select count(*) from public.audit_log where action like 'device_%') = 5,
                     'los eventos de dispositivos quedan auditados');

-- 11. Borrado en cascada de un usuario
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select count(*) from public.profiles) = 1, 'al borrar el usuario se borran sus datos');

-- 12. Fase 1.1: tareas de todo el día
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.tasks (user_id, title, due_at, due_all_day)
values ('11111111-1111-1111-1111-111111111111', 'todo el día', now(), true);
select pg_temp.check((select count(*) from public.tasks where due_all_day) = 1, 'se guarda una tarea de todo el día');
do $$ begin
  insert into public.tasks (user_id, title, due_all_day) values ('11111111-1111-1111-1111-111111111111', 'x', true);
  raise exception 'FALLÓ: todo el día sin fecha';
exception when check_violation then raise notice 'OK: una tarea de todo el día requiere fecha';
end $$;
update public.tasks set status = 'done', completed_at = now(), completion_confirmed = true where title = 'todo el día';
select pg_temp.check((select completion_confirmed from public.tasks where title = 'todo el día'), 'completar una tarea queda confirmado');
reset role;

-- 13. Fase 1.2: reuniones, participantes y recordatorios
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.meetings (id, user_id, title, starts_at, ends_at, status, source, confirmed_at)
values ('aaaaaaaa-0000-0000-0000-000000000010', '11111111-1111-1111-1111-111111111111', 'Revisión pedido',
        now() + interval '1 day', now() + interval '1 day 1 hour', 'scheduled', 'manual', now());
insert into public.meeting_participants (user_id, meeting_id, display_name)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'Mi jefe');
insert into public.reminders (user_id, meeting_id, title, remind_at)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000010', 'Revisión pedido',
        now() + interval '23 hours 45 minutes');
select pg_temp.check((select count(*) from public.reminders where status = 'scheduled') = 1, 'se programa el recordatorio de la reunión');
update public.reminders set status = 'cancelled' where meeting_id = 'aaaaaaaa-0000-0000-0000-000000000010';
select pg_temp.check((select status from public.reminders limit 1) = 'cancelled', 'el usuario puede cancelar su recordatorio');
delete from public.meeting_participants where meeting_id = 'aaaaaaaa-0000-0000-0000-000000000010' and contact_id is null;
select pg_temp.check((select count(*) from public.meeting_participants) = 0, 'se reemplazan los participantes escritos');
reset role;
-- B (recreado) no puede colgar recordatorios ni participantes de reuniones de A
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'usuario.c@example.com');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
do $$ begin
  insert into public.reminders (user_id, meeting_id, title, remind_at)
  values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000010', 'x', now());
  raise exception 'FALLÓ: recordatorio sobre reunión ajena';
exception when foreign_key_violation then raise notice 'OK: no se pueden crear recordatorios sobre reuniones ajenas';
end $$;
do $$ begin
  insert into public.meeting_participants (user_id, meeting_id, display_name)
  values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000010', 'intruso');
  raise exception 'FALLÓ: participante en reunión ajena';
exception when foreign_key_violation then raise notice 'OK: no se pueden agregar participantes a reuniones ajenas';
end $$;
reset role;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
delete from public.meetings where id = 'aaaaaaaa-0000-0000-0000-000000000010';
select pg_temp.check((select count(*) from public.reminders where meeting_id = 'aaaaaaaa-0000-0000-0000-000000000010') = 0,
                     'al borrar la reunión se borran sus recordatorios');
reset role;

-- 14. Fase 1.3: actividades recurrentes
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.recurrence_rules (id, user_id, rrule, timezone, starts_on, applies_to, reminder_minutes)
values ('aaaaaaaa-0000-0000-0000-000000000020', '11111111-1111-1111-1111-111111111111',
        'FREQ=WEEKLY;BYDAY=MO', 'America/Mexico_City', '2026-11-09', 'meeting', 15);
insert into public.meetings (user_id, recurrence_rule_id, title, starts_at, ends_at, status, source, confirmed_at)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000020', 'Junta semanal',
        '2026-11-09 16:00+00', '2026-11-09 17:00+00', 'scheduled', 'manual', now()),
       ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000020', 'Junta semanal',
        '2026-11-16 16:00+00', '2026-11-16 17:00+00', 'scheduled', 'manual', now());
select pg_temp.check((select count(*) from public.meetings where recurrence_rule_id = 'aaaaaaaa-0000-0000-0000-000000000020') = 2,
                     'se crean las repeticiones de una serie de reuniones');
do $$ begin
  insert into public.meetings (user_id, recurrence_rule_id, title, starts_at, ends_at, status, source)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000020', 'Junta semanal',
          '2026-11-09 16:00+00', '2026-11-09 17:00+00', 'scheduled', 'manual');
  raise exception 'FALLÓ: repetición duplicada de reunión';
exception when unique_violation then raise notice 'OK: una repetición de reunión no se duplica';
end $$;
insert into public.recurrence_rules (id, user_id, rrule, timezone, starts_on, applies_to)
values ('aaaaaaaa-0000-0000-0000-000000000021', '11111111-1111-1111-1111-111111111111',
        'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', 'America/Mexico_City', '2026-11-03', 'task');
insert into public.tasks (user_id, recurrence_rule_id, title, due_at, due_all_day, source)
values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000021', 'Revisar pedidos',
        '2026-11-04 05:59:59+00', true, 'recurrence');
do $$ begin
  insert into public.tasks (user_id, recurrence_rule_id, title, due_at, due_all_day, source)
  values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000021', 'Revisar pedidos',
          '2026-11-04 05:59:59+00', true, 'recurrence');
  raise exception 'FALLÓ: repetición duplicada de tarea';
exception when unique_violation then raise notice 'OK: una repetición de tarea no se duplica';
end $$;
-- Tareas sin serie no se ven afectadas por el índice único
insert into public.tasks (user_id, title, due_at) values
  ('11111111-1111-1111-1111-111111111111', 'Suelta 1', '2026-11-04 05:59:59+00'),
  ('11111111-1111-1111-1111-111111111111', 'Suelta 2', '2026-11-04 05:59:59+00');
select pg_temp.check(true, 'tareas sin serie pueden compartir fecha');
do $$ begin
  insert into public.recurrence_rules (user_id, rrule, timezone, starts_on, applies_to)
  values ('11111111-1111-1111-1111-111111111111', 'FREQ=DAILY', 'America/Mexico_City', '2026-11-03', 'email');
  raise exception 'FALLÓ: applies_to inválido aceptado';
exception when check_violation then raise notice 'OK: applies_to solo acepta task o meeting';
end $$;
do $$ begin
  insert into public.recurrence_rules (user_id, rrule, timezone, starts_on, reminder_minutes)
  values ('11111111-1111-1111-1111-111111111111', 'FREQ=DAILY', 'America/Mexico_City', '2026-11-03', -5);
  raise exception 'FALLÓ: reminder_minutes negativo aceptado';
exception when check_violation then raise notice 'OK: reminder_minutes fuera de rango se rechaza';
end $$;
-- Detener la serie: termina la regla y se borran las siguientes programadas
update public.recurrence_rules set until_date = '2026-11-09' where id = 'aaaaaaaa-0000-0000-0000-000000000020';
delete from public.meetings where recurrence_rule_id = 'aaaaaaaa-0000-0000-0000-000000000020'
  and status = 'scheduled' and starts_at > '2026-11-09 16:00+00';
select pg_temp.check((select count(*) from public.meetings where recurrence_rule_id = 'aaaaaaaa-0000-0000-0000-000000000020') = 1,
                     'al detener la serie quedan solo las reuniones hasta esa fecha');
reset role;
-- C no ve ni usa reglas de A
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.check((select count(*) from public.recurrence_rules) = 0, 'otro usuario no ve las reglas de repetición');
do $$ begin
  insert into public.tasks (user_id, recurrence_rule_id, title)
  values ('33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000021', 'intrusa');
  raise exception 'FALLÓ: tarea colgada de regla ajena';
exception when foreign_key_violation then raise notice 'OK: no se puede usar la regla de repetición de otro usuario';
end $$;
reset role;

-- 15. Fase 1.6: cambios simultáneos (bloqueo optimista con updated_at)
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
insert into public.tasks (id, user_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000030', '11111111-1111-1111-1111-111111111111', 'Editar en dos equipos');
create temp table v as select updated_at from public.tasks where id = 'aaaaaaaa-0000-0000-0000-000000000030';
-- Otro dispositivo guarda primero (en otra transacción el reloj avanza)
select pg_sleep(0.01);
update public.tasks set title = 'Cambio desde el celular', updated_at = now() + interval '1 second'
  where id = 'aaaaaaaa-0000-0000-0000-000000000030';
with u as (
  update public.tasks set title = 'Cambio desde la tablet'
  where id = 'aaaaaaaa-0000-0000-0000-000000000030' and updated_at = (select updated_at from v)
  returning 1
)
select pg_temp.check((select count(*) from u) = 0, 'una edición con versión vieja no sobrescribe el cambio de otro dispositivo');
select pg_temp.check((select title from public.tasks where id = 'aaaaaaaa-0000-0000-0000-000000000030') = 'Cambio desde el celular',
                     'se conserva el cambio más reciente');
reset role;

\echo 'TODAS LAS PRUEBAS DE BASE DE DATOS PASARON'
