-- Avisos con la app cerrada (Web Push; listo para FCM en la app de Android).
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
    kind text not null default 'web' check (kind in ('web', 'fcm')),
    endpoint text not null unique,          -- web: URL del servicio de avisos; fcm: token del dispositivo
    p256dh text,
    auth text,
    platform text,
    created_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_profile on public.push_subscriptions(profile_id);
alter table public.push_subscriptions enable row level security;
create policy "Mis dispositivos" on public.push_subscriptions for all to authenticated
    using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Datos públicos de configuración (la llave pública la necesita el navegador para suscribirse)
create table if not exists public.push_config (key text primary key, value text not null);
alter table public.push_config enable row level security;
create policy "Lectura de configuración de avisos" on public.push_config for select to authenticated using (true);
insert into public.push_config (key, value) values ('function_url', 'https://xgrwivblrrucucjhrmni.supabase.co/functions/v1/send-push')
on conflict (key) do nothing;

-- Secretos: en el esquema privado (no se exponen por la API). Se generan solos; nadie los escribe a mano.
create table if not exists private.push_secrets (name text primary key, value text not null);
insert into private.push_secrets (name, value)
values ('webhook', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- Registrar este dispositivo (si el mismo navegador lo usaba otra cuenta, pasa a la cuenta actual)
create or replace function public.push_register(p_endpoint text, p_p256dh text, p_auth text, p_kind text default 'web', p_platform text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
    if auth.uid() is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    if coalesce(p_endpoint, '') = '' then raise exception 'Falta el dispositivo'; end if;
    insert into push_subscriptions (profile_id, kind, endpoint, p256dh, auth, platform)
    values (auth.uid(), coalesce(p_kind, 'web'), p_endpoint, p_p256dh, p_auth, p_platform)
    on conflict (endpoint) do update
        set profile_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, platform = excluded.platform, last_seen_at = now();
end $$;
revoke all on function public.push_register(text, text, text, text, text) from public, anon;
grant execute on function public.push_register(text, text, text, text, text) to authenticated;

-- Solo para la función del servidor (service_role)
create or replace function public.push_secret_ok(p text)
returns boolean language sql stable security definer set search_path to 'public' as $$
    select exists (select 1 from private.push_secrets where name = 'webhook' and value = p);
$$;
create or replace function public.push_vapid()
returns jsonb language sql stable security definer set search_path to 'public' as $$
    select case when (select value from private.push_secrets where name = 'vapid_private') is null then null
           else jsonb_build_object('publicKey', (select value from push_config where key = 'vapid_public_key'),
                                   'privateKey', (select value from private.push_secrets where name = 'vapid_private')) end;
$$;
create or replace function public.push_store_vapid(p_public text, p_private text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
    insert into private.push_secrets (name, value) values ('vapid_private', p_private) on conflict (name) do nothing;
    if found then
        insert into push_config (key, value) values ('vapid_public_key', p_public)
        on conflict (key) do update set value = excluded.value;
    end if;
    return public.push_vapid();
end $$;

-- A quién avisar y qué decir, según lo que pasó
create or replace function public.push_targets(p_kind text, p_id uuid)
returns table(sub_id uuid, kind text, endpoint text, p256dh text, auth text, title text, body text, url text, tag text)
language sql stable security definer set search_path to 'public' as $$
    -- Mensaje de chat: a los demás participantes
    select s.id, s.kind, s.endpoint, s.p256dh, s.auth,
           case when m.sender_id is null then coalesce(r.name, 'VUNLEK')
                else 'Mensaje de ' || coalesce(public.chat_label(m.sender_id, r.tenant_id), 'VUNLEK') end,
           case m.type when 'IMAGE' then 'Foto' when 'AUDIO' then 'Nota de voz'
                when 'DOCUMENT' then 'Documento' else left(coalesce(m.content, 'Mensaje nuevo'), 90) end,
           '/messages/' || m.room_id, 'chat-' || m.room_id
      from chat_messages m
      join chat_rooms r on r.id = m.room_id
      join chat_participants cp on cp.room_id = m.room_id and cp.profile_id is distinct from m.sender_id
      join push_subscriptions s on s.profile_id = cp.profile_id
     where p_kind = 'chat' and m.id = p_id
    union all
    -- Reporte de un alumno: a sus tutores con cuenta (sin detalles en la pantalla bloqueada)
    select s.id, s.kind, s.endpoint, s.p256dh, s.auth,
           'Aviso de la escuela', 'Hay un reporte nuevo sobre ' || initcap(st.first_name) || '. Toca para verlo.',
           '/incidents', 'incidente-' || i.id
      from student_incidents i
      join students st on st.id = i.student_id
      join guardians g on g.student_id = i.student_id and g.user_id is not null
      join push_subscriptions s on s.profile_id = g.user_id
     where p_kind = 'incident' and i.id = p_id and not coalesce(i.is_private, false)
    union all
    -- Citatorio
    select s.id, s.kind, s.endpoint, s.p256dh, s.auth,
           'Citatorio de la escuela', 'Te citan por ' || initcap(st.first_name) || coalesce(' el ' || to_char(c.meeting_date, 'DD/MM/YYYY'), '') || '. Toca para ver los detalles.',
           '/', 'citatorio-' || c.id
      from student_citations c
      join students st on st.id = c.student_id
      join guardians g on g.student_id = c.student_id and g.user_id is not null
      join push_subscriptions s on s.profile_id = g.user_id
     where p_kind = 'citation' and c.id = p_id
    union all
    -- Alerta directa al tutor (faltas, urgencias)
    select s.id, s.kind, s.endpoint, s.p256dh, s.auth,
           coalesce(nullif(a.title, ''), 'Aviso de la escuela'), left(coalesce(a.message, 'Toca para verlo.'), 140),
           '/', 'alerta-' || a.id
      from student_alerts a
      join push_subscriptions s on s.profile_id = a.tutor_id
     where p_kind = 'alert' and a.id = p_id
    union all
    -- Prueba: a los dispositivos de la propia persona
    select s.id, s.kind, s.endpoint, s.p256dh, s.auth,
           'Prueba de VUNLEK', 'Si ves esto con la app cerrada, los avisos urgentes te van a llegar.', '/settings?tab=avisos', 'vunlek-prueba'
      from push_subscriptions s
     where p_kind = 'test' and s.profile_id = p_id;
$$;

-- La persona pide un aviso de prueba a sus propios dispositivos (llega unos segundos después, para dar tiempo de cerrar la app)
create or replace function public.push_test(p_delay int default 10)
returns int language plpgsql security definer set search_path to 'public' as $$
declare v_url text; v_secret text; n int;
begin
    if auth.uid() is null then raise exception 'Sesión requerida' using errcode = '42501'; end if;
    select count(*) into n from push_subscriptions where profile_id = auth.uid();
    select value into v_url from public.push_config where key = 'function_url';
    select value into v_secret from private.push_secrets where name = 'webhook';
    if n > 0 and v_url is not null and v_secret is not null then
        perform net.http_post(url := v_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
            body := jsonb_build_object('kind', 'test', 'id', auth.uid(), 'delay', least(greatest(coalesce(p_delay, 0), 0), 20)),
            timeout_milliseconds := 40000);
    end if;
    return n;
end $$;
revoke all on function public.push_test(int) from public, anon;
grant execute on function public.push_test(int) to authenticated;
revoke all on function public.push_secret_ok(text), public.push_vapid(), public.push_store_vapid(text, text), public.push_targets(text, uuid) from public, anon, authenticated;
grant execute on function public.push_secret_ok(text), public.push_vapid(), public.push_store_vapid(text, text), public.push_targets(text, uuid) to service_role;

-- Al guardarse un mensaje, reporte, citatorio o alerta, se pide el envío (sin detener el guardado si falla)
create or replace function private.push_enqueue()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_url text; v_secret text;
begin
    select value into v_url from public.push_config where key = 'function_url';
    select value into v_secret from private.push_secrets where name = 'webhook';
    if v_url is not null and v_secret is not null then
        perform net.http_post(url := v_url,
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
            body := jsonb_build_object('kind', tg_argv[0], 'id', new.id));
    end if;
    return new;
exception when others then
    return new;
end $$;
create or replace trigger tr_push_chat after insert on public.chat_messages for each row execute function private.push_enqueue('chat');
create or replace trigger tr_push_incident after insert on public.student_incidents for each row execute function private.push_enqueue('incident');
create or replace trigger tr_push_citation after insert on public.student_citations for each row execute function private.push_enqueue('citation');
create or replace trigger tr_push_alert after insert on public.student_alerts for each row execute function private.push_enqueue('alert');
