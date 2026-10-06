-- Desde la lista de solicitudes de presupuesto: generar la clave de licencia de esa escuela
-- y registrar a qué correo se envió.

alter table public.sales_leads
    add column if not exists license_key_id uuid references public.license_keys(id) on delete set null,
    add column if not exists key_sent_at timestamptz,
    add column if not exists key_sent_to text;

create or replace function public.admin_issue_key_for_lead(p_lead bigint, p_months integer default 12, p_new boolean default false)
returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions'
as $$
declare
    l record;
    k record;
    v_reused boolean := false;
begin
    if not public.is_god_mode() then raise exception 'Solo modo dios' using errcode = '42501'; end if;
    select * into l from sales_leads where id = p_lead for update;
    if not found then raise exception 'La solicitud ya no existe'; end if;

    if l.license_key_id is not null and not p_new then
        select * into k from license_keys where id = l.license_key_id;
        if found and k.status = 'AVAILABLE' then v_reused := true; end if;
    end if;
    if not v_reused then
        select * into k from public.admin_generate_license_keys(p_months, 1,
            left('Para ' || coalesce(l.school_name, 'escuela') || ' · ' || l.email, 200));
        update sales_leads set license_key_id = k.id, key_sent_at = null, key_sent_to = null where id = p_lead;
    end if;
    return jsonb_build_object('key', k.key, 'months', k.months, 'status', k.status, 'reused', v_reused,
        'email', l.email, 'contact', l.contact_name, 'school', coalesce(l.school_name, ''));
end $$;

create or replace function public.admin_mark_key_sent(p_lead bigint)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
    if not public.is_god_mode() then raise exception 'Solo modo dios' using errcode = '42501'; end if;
    update sales_leads set key_sent_at = now(), key_sent_to = email,
           status = case when status in ('NEW', 'CONTACTED') then 'WON' else status end
    where id = p_lead and license_key_id is not null;
end $$;

revoke all on function public.admin_issue_key_for_lead(bigint, integer, boolean) from public, anon;
revoke all on function public.admin_mark_key_sent(bigint) from public, anon;
grant execute on function public.admin_issue_key_for_lead(bigint, integer, boolean), public.admin_mark_key_sent(bigint) to authenticated;
