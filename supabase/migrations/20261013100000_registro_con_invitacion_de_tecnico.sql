-- Una cuenta NUEVA creada desde una invitación de Administrador técnico fallaba con
-- "Database error saving new user": el alta de usuarios no reconocía ese puesto.
do $$
declare d text;
begin
    select pg_get_functiondef('public.handle_new_user()'::regprocedure) into d;
    if d not like '%''STUDENT'', ''SYSTEM_ADMIN'')%' then
        d := replace(d, $q$'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT')$q$, $q$'TEACHER', 'PREFECT', 'SUPPORT', 'TUTOR', 'STUDENT', 'SYSTEM_ADMIN')$q$);
        execute d;
    end if;
end $$;
