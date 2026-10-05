-- Para ligar a un alumno, la familia escribe el código que entrega la escuela Y la CURP del alumno.
-- Así un código extraviado o fotografiado no basta para ver la información de un niño.

create or replace function private.curp_matches_name(p_curp text, p_first text, p_paternal text)
returns boolean language plpgsql immutable set search_path to 'public' as $$
declare
    norm_p text := upper(translate(coalesce(p_paternal, ''), 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUXX'));
    norm_f text := upper(translate(coalesce(p_first, ''), 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUXX'));
    w text; p1 text := null; ok_first boolean := false;
begin
    -- Primer apellido: se ignoran partículas (DE, DEL, LA…)
    foreach w in array regexp_split_to_array(trim(norm_p), '\s+') loop
        if w <> '' and w not in ('DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'MC', 'MAC', 'VAN', 'VON', 'DA', 'DI') then p1 := substr(w, 1, 1); exit; end if;
    end loop;
    if p1 is null then p1 := substr(trim(norm_p), 1, 1); end if;
    -- Nombre: la CURP usa el primero, salvo JOSÉ/MARÍA en nombres compuestos; se acepta la inicial de cualquiera
    foreach w in array regexp_split_to_array(trim(norm_f), '\s+') loop
        if w <> '' and substr(w, 1, 1) = substr(p_curp, 4, 1) then ok_first := true; end if;
    end loop;
    return coalesce(p1, '') <> '' and substr(p_curp, 1, 1) = p1 and ok_first;
end $$;

create or replace function public.redeem_family_access(p_code text, p_curp text, p_first_name text default null, p_last_name_paternal text default null, p_last_name_maternal text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
    v_uid uuid := auth.uid();
    v_clean text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    v_curp text := upper(regexp_replace(coalesce(p_curp, ''), '[^A-Za-z0-9]', '', 'g'));
    st record;
    v_bad constant text := 'El código y la CURP no corresponden al mismo alumno. Revisa los dos; si sigue igual, acude a control escolar.';
begin
    if v_uid is null then raise exception 'Inicia sesión para usar el código' using errcode = '42501'; end if;
    if (select count(*) from private.family_code_attempts
         where profile_id = v_uid and not ok and created_at > now() - interval '1 hour') >= 10 then
        raise exception 'Demasiados intentos incorrectos. Espera una hora o pide ayuda a control escolar.';
    end if;
    if v_curp !~ '^[A-Z]{4}[0-9]{6}[HMX][A-Z]{5}[A-Z0-9][0-9]$' then
        return jsonb_build_object('error', 'La CURP tiene 18 letras y números. Cópiala tal como viene en el acta de nacimiento o la constancia.');
    end if;
    -- Código mal escrito o inexistente: lo maneja (y cuenta el intento) la función de siempre
    if length(v_clean) <> 8 then return public.redeem_family_code(p_code, p_first_name, p_last_name_paternal, p_last_name_maternal); end if;
    select s.id, s.curp, s.first_name, s.last_name_paternal into st
      from public.students s where s.family_code = substr(v_clean, 1, 4) || '-' || substr(v_clean, 5, 4);
    if st.id is null then return public.redeem_family_code(p_code, p_first_name, p_last_name_paternal, p_last_name_maternal); end if;

    if nullif(trim(coalesce(st.curp, '')), '') is not null then
        if upper(regexp_replace(st.curp, '[^A-Za-z0-9]', '', 'g')) <> v_curp then
            insert into private.family_code_attempts (profile_id, ok) values (v_uid, false);
            return jsonb_build_object('error', v_bad);
        end if;
    else
        -- La escuela aún no tiene la CURP: debe ser coherente con el nombre del alumno, y queda guardada
        if not private.curp_matches_name(v_curp, st.first_name, st.last_name_paternal) then
            insert into private.family_code_attempts (profile_id, ok) values (v_uid, false);
            return jsonb_build_object('error', v_bad);
        end if;
        update public.students set curp = v_curp where id = st.id and nullif(trim(coalesce(curp, '')), '') is null;
    end if;
    return public.redeem_family_code(p_code, p_first_name, p_last_name_paternal, p_last_name_maternal);
end $$;
revoke all on function public.redeem_family_access(text, text, text, text, text) from public, anon;
grant execute on function public.redeem_family_access(text, text, text, text, text) to authenticated;

-- El código solo, sin CURP, ya no se puede usar directamente
revoke execute on function public.redeem_family_code(text, text, text, text) from public, anon, authenticated;
