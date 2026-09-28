-- Dar de baja una cuenta de verdad.
-- Antes solo se renombraba el correo: el acceso con Google seguía ligado al mismo usuario
-- (auth.identities), así que al volver a entrar con Gmail se abría el espacio "eliminado".
-- Ahora, además:
--   * se desvinculan todos los accesos (Google / correo) y se cierran las sesiones;
--   * se bloquea el usuario anterior;
--   * sale de todos sus espacios; los espacios donde era el único miembro quedan sin acceso.
-- Si la persona vuelve a entrar con el mismo correo, empieza desde cero con un usuario nuevo.
-- Los registros escolares no se borran físicamente (quedan inaccesibles) para no romper
-- referencias entre tablas; se pueden depurar después con un proceso administrativo.
create or replace function private.soft_delete_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
    current_email text;
    original_email text;
begin
    select email, coalesce(raw_user_meta_data->>'deleted_original_email', email)
      into current_email, original_email
      from auth.users where id = target_user_id;
    if current_email is null then
        return;
    end if;
    -- Si ya venía de una baja anterior, recupera el correo original (sin encadenar ".deleted...")
    original_email := split_part(original_email, '.deleted.', 1);

    -- 1. Libera el correo y bloquea al usuario anterior
    update auth.users
       set email = original_email || '.deleted.' || floor(extract(epoch from now()))::bigint || '@internal.edu',
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('deleted_original_email', original_email),
           banned_until = 'infinity'
     where id = target_user_id;

    -- 2. Desvincula Google / correo y cierra sesiones
    delete from auth.identities where user_id = target_user_id;
    delete from auth.sessions where user_id = target_user_id;

    -- 3. Sale de todos sus espacios
    delete from public.profile_tenants where profile_id = target_user_id;

    -- 4. Marca el perfil como eliminado
    update public.profiles set deleted_at = now() where id = target_user_id;
end;
$$;

revoke all on function private.soft_delete_account(uuid) from public, anon, authenticated;
