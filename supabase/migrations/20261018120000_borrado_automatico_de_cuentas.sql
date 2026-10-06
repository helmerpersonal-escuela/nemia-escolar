-- Borrado definitivo automático de las cuentas dadas de baja.
-- "Eliminar mi cuenta" bloquea el acceso de inmediato (baja). 25 días después, esta tarea diaria
-- borra la cuenta y sus datos personales de forma definitiva, para cumplir el plazo máximo de
-- 30 días que prometen la Política de Privacidad y las tiendas de aplicaciones.
-- Antes de ese plazo la cuenta todavía puede restaurarse desde modo dios.
-- Requiere public.admin_delete_user (20261016110000_modo_dios_borrar_persona.sql).

create table if not exists private.account_purges (
    id bigint generated always as identity primary key,
    user_id uuid not null,
    deleted_at timestamptz,
    purged_at timestamptz not null default now(),
    ok boolean not null,
    error text
);

create or replace function private.purge_deleted_accounts(p_days integer default 25)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    v_admin uuid;
    v_prev text := current_setting('request.jwt.claims', true);
    r record;
    n_ok int := 0;
    n_fail int := 0;
begin
    -- El borrado usa la misma función que el botón de modo dios, que exige un super administrador:
    -- la tarea actúa en su nombre solo dentro de esta operación.
    select u.id into v_admin from auth.users u
    where lower(u.email) in ('helmerferras@gmail.com', 'helmerpersonal@gmail.com') and u.email_confirmed_at is not null
    order by u.created_at limit 1;
    if v_admin is null then
        select profile_id into v_admin from profile_roles where role = 'SUPER_ADMIN' limit 1;
    end if;
    if v_admin is null then return jsonb_build_object('success', false, 'error', 'No hay super administrador'); end if;
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

    for r in
        select p.id, p.deleted_at from profiles p
        where p.deleted_at is not null and p.id <> v_admin
          -- las bajas anteriores a esta tarea cuentan su plazo desde el día en que se activó
          and greatest(p.deleted_at, timestamptz '2026-10-06 00:00:00+00') < now() - make_interval(days => p_days)
        order by p.deleted_at
    loop
        begin
            perform public.admin_delete_user(r.id);
            insert into private.account_purges (user_id, deleted_at, ok) values (r.id, r.deleted_at, true);
            n_ok := n_ok + 1;
        exception when others then
            -- Si una cuenta no se puede borrar, se anota y se sigue con las demás
            insert into private.account_purges (user_id, deleted_at, ok, error) values (r.id, r.deleted_at, false, left(sqlerrm, 300));
            n_fail := n_fail + 1;
        end;
    end loop;

    perform set_config('request.jwt.claims', coalesce(v_prev, ''), true);
    return jsonb_build_object('success', true, 'purged', n_ok, 'failed', n_fail);
end $$;

revoke all on function private.purge_deleted_accounts(integer) from public, anon, authenticated;

-- Para modo dios: últimos resultados de la tarea
create or replace function public.admin_account_purges()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
    if not public.is_god_mode() then raise exception 'No autorizado'; end if;
    return jsonb_build_object(
        'days', 25,
        'total', (select count(*) from private.account_purges where ok),
        'failed', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'error', error, 'at', purged_at) order by purged_at desc)
                            from (select distinct on (user_id) * from private.account_purges order by user_id, purged_at desc) x
                            where not x.ok and exists (select 1 from profiles p where p.id = x.user_id)), '[]'::jsonb));
end $$;
revoke all on function public.admin_account_purges() from public, anon;
grant execute on function public.admin_account_purges() to authenticated;

select cron.schedule('purge-deleted-accounts', '20 9 * * *', $cron$select private.purge_deleted_accounts()$cron$);
