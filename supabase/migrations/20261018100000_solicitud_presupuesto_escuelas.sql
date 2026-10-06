-- Solicitud de presupuesto para escuelas: el precio depende del número de docentes y alumnos,
-- así que la escuela interesada deja sus datos y ventas la contacta. Se puede enviar sin tener
-- cuenta (página pública) o desde dentro de la app (dirección).

alter table public.sales_leads
    add column if not exists school_name text,
    add column if not exists cct text,
    add column if not exists educational_level text,
    add column if not exists locality text,
    add column if not exists role_title text,
    add column if not exists teachers_count integer check (teachers_count is null or teachers_count between 1 and 5000),
    add column if not exists students_count integer check (students_count is null or students_count between 1 and 100000),
    add column if not exists source text not null default 'APP' check (source in ('APP', 'PUBLIC')),
    add column if not exists consent_at timestamptz;

create or replace function public.submit_school_lead(p jsonb)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
    v_uid uuid := auth.uid();
    v_tenant uuid;
    v_name text := left(nullif(trim(coalesce(p->>'name', '')), ''), 120);
    v_email text := lower(left(nullif(trim(coalesce(p->>'email', '')), ''), 160));
    v_phone text := left(nullif(trim(coalesce(p->>'phone', '')), ''), 30);
    v_school text := left(nullif(trim(coalesce(p->>'school', '')), ''), 160);
    v_teachers int;
    v_students int;
    v_sales text;
    v_id bigint;
begin
    begin
        v_teachers := nullif(trim(coalesce(p->>'teachers', '')), '')::int;
        v_students := nullif(trim(coalesce(p->>'students', '')), '')::int;
    exception when others then
        raise exception 'El número de docentes y de alumnos debe escribirse solo con números';
    end;
    if v_uid is not null then
        v_tenant := public.get_current_tenant_id();
        if v_email is null then select lower(email) into v_email from auth.users where id = v_uid; end if;
        if v_school is null then select name into v_school from tenants where id = v_tenant; end if;
    end if;

    if v_name is null then raise exception 'Escribe tu nombre'; end if;
    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Escribe un correo válido'; end if;
    if v_phone is null or length(regexp_replace(v_phone, '\D', '', 'g')) < 10 then raise exception 'Escribe un teléfono de 10 dígitos'; end if;
    if v_school is null then raise exception 'Escribe el nombre de la escuela'; end if;
    if v_teachers is null or v_teachers < 1 or v_teachers > 5000 then raise exception 'Indica cuántos docentes tiene la escuela'; end if;
    if v_students is null or v_students < 1 or v_students > 100000 then raise exception 'Indica cuántos alumnos tiene la escuela'; end if;
    if coalesce((p->>'consent')::boolean, false) is not true then raise exception 'Necesitamos tu autorización para contactarte'; end if;

    -- Freno contra envíos repetidos o automáticos
    if (select count(*) from sales_leads where lower(email) = v_email and created_at > now() - interval '1 day') >= 3 then
        raise exception 'Ya recibimos tu solicitud; ventas te contactará pronto.';
    end if;
    if (select count(*) from sales_leads where source = 'PUBLIC' and created_at > now() - interval '1 hour') >= 40 then
        raise exception 'Estamos recibiendo muchas solicitudes. Inténtalo de nuevo en una hora.';
    end if;

    insert into sales_leads (tenant_id, user_id, contact_name, email, phone, users_count, message,
                             school_name, cct, educational_level, locality, role_title, teachers_count, students_count, source, consent_at)
    values (v_tenant, v_uid, v_name, v_email, v_phone, v_teachers,
            left(nullif(trim(coalesce(p->>'message', '')), ''), 1000),
            v_school, upper(left(nullif(trim(coalesce(p->>'cct', '')), ''), 20)),
            left(nullif(trim(coalesce(p->>'level', '')), ''), 40), left(nullif(trim(coalesce(p->>'locality', '')), ''), 120),
            left(nullif(trim(coalesce(p->>'role', '')), ''), 80), v_teachers, v_students,
            case when v_uid is null then 'PUBLIC' else 'APP' end, now())
    returning id into v_id;

    -- Aviso por correo a ventas (solo cuando la solicitud viene de un espacio ya creado)
    if v_tenant is not null then
        insert into billing_events (tenant_id, user_id, kind, detail)
        values (v_tenant, v_uid, 'SALES_LEAD', jsonb_build_object('lead_id', v_id, 'teachers', v_teachers, 'students', v_students));
        select nullif(trim(value), '') into v_sales from system_settings where key = 'sales_email';
        if v_sales is not null then
            insert into billing_notices (tenant_id, kind, email, name, payload)
            values (v_tenant, 'SALES_LEAD', v_sales, 'Ventas', jsonb_build_object('space', v_school, 'contact', v_name, 'contact_email', v_email,
                    'phone', v_phone, 'users', v_teachers, 'students', v_students, 'message', p->>'message'));
        end if;
    end if;
    return jsonb_build_object('success', true, 'id', v_id);
end $$;

revoke all on function public.submit_school_lead(jsonb) from public;
grant execute on function public.submit_school_lead(jsonb) to anon, authenticated;
