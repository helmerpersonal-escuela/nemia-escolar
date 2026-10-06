-- Las cuentas dadas de baja quedaban bloqueadas "hasta el infinito". El servicio de cuentas de
-- Supabase no puede leer esa fecha y fallaba al listar usuarios ("Database error finding users"),
-- tanto en el panel como en los scripts. Se usa una fecha lejana, que bloquea igual.
update auth.users set banned_until = '2999-12-31 00:00:00+00' where banned_until = 'infinity';

create or replace function public.soft_delete_account(target_user_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null or (target_user_id <> auth.uid() and not public.is_god_mode()) then
    raise exception 'No autorizado: solo puedes dar de baja tu propia cuenta';
  end if;
  perform private.soft_delete_account(target_user_id);
  update auth.users set banned_until = '2999-12-31 00:00:00+00' where id = target_user_id and banned_until = 'infinity';
end; $$;
