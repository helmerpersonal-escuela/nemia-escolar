-- Indicadores agregados de la escuela para preparar el CTE (sin datos personales).
CREATE OR REPLACE FUNCTION public.cte_school_indicators(p_tenant uuid, p_from date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_from   date := coalesce(p_from, current_date - 60);
    v_groups jsonb;
    v_inc    jsonb;
    v_total  jsonb;
BEGIN
    IF NOT public.is_cte_manager(p_tenant) THEN
        RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
    END IF;

    WITH g AS (
        SELECT id, grade, section FROM public.groups WHERE tenant_id = p_tenant
    ),
    st AS (
        SELECT group_id, count(*) AS students
        FROM public.students
        WHERE tenant_id = p_tenant AND coalesce(status, 'ACTIVE') NOT IN ('INACTIVE', 'BAJA', 'WITHDRAWN')
        GROUP BY group_id
    ),
    att AS (
        SELECT group_id,
               count(*) AS records,
               round(100.0 * count(*) FILTER (WHERE upper(status) IN ('PRESENT', 'LATE'))
                     / nullif(count(*), 0), 1) AS attendance_pct
        FROM public.attendance
        WHERE tenant_id = p_tenant AND date >= v_from
        GROUP BY group_id
    ),
    per_student AS (
        SELECT a.group_id, gr.student_id, avg(gr.score) AS avg_score
        FROM public.grades gr
        JOIN public.assignments a ON a.id = gr.assignment_id
        WHERE gr.tenant_id = p_tenant AND gr.score IS NOT NULL
          AND coalesce(gr.graded_at, gr.created_at) >= v_from
        GROUP BY a.group_id, gr.student_id
    ),
    sc AS (
        SELECT group_id,
               round(avg(avg_score)::numeric, 2) AS avg_score,
               count(*) FILTER (WHERE avg_score < 6) AS students_below_6
        FROM per_student GROUP BY group_id
    ),
    inc AS (
        SELECT s.group_id, count(*) AS incidents
        FROM public.student_incidents i
        JOIN public.students s ON s.id = i.student_id
        WHERE i.tenant_id = p_tenant AND i.created_at >= v_from
        GROUP BY s.group_id
    )
    SELECT coalesce(jsonb_agg(jsonb_build_object(
               'grupo', g.grade || '°' || coalesce(' ' || g.section, ''),
               'alumnos', coalesce(st.students, 0),
               'asistencia_pct', att.attendance_pct,
               'promedio', sc.avg_score,
               'alumnos_promedio_menor_6', coalesce(sc.students_below_6, 0),
               'incidencias', coalesce(inc.incidents, 0)
           ) ORDER BY g.grade, g.section), '[]'::jsonb)
      INTO v_groups
    FROM g
    LEFT JOIN st  ON st.group_id  = g.id
    LEFT JOIN att ON att.group_id = g.id
    LEFT JOIN sc  ON sc.group_id  = g.id
    LEFT JOIN inc ON inc.group_id = g.id;

    SELECT coalesce(jsonb_agg(jsonb_build_object('tipo', type, 'gravedad', severity, 'total', n) ORDER BY n DESC), '[]'::jsonb)
      INTO v_inc
    FROM (
        SELECT coalesce(type, 'SIN_TIPO') AS type, coalesce(severity, 'N/D') AS severity, count(*) AS n
        FROM public.student_incidents
        WHERE tenant_id = p_tenant AND created_at >= v_from
        GROUP BY 1, 2
        ORDER BY 3 DESC
        LIMIT 12
    ) x;

    SELECT jsonb_build_object(
        'desde', v_from,
        'grupos', (SELECT count(*) FROM public.groups WHERE tenant_id = p_tenant),
        'alumnos', (SELECT count(*) FROM public.students WHERE tenant_id = p_tenant),
        'planeaciones_periodo', (SELECT count(*) FROM public.lesson_plans WHERE tenant_id = p_tenant AND created_at >= v_from)
    ) INTO v_total;

    RETURN jsonb_build_object('resumen', v_total, 'por_grupo', v_groups, 'incidencias_por_tipo', v_inc);
END;
$$;
REVOKE ALL ON FUNCTION public.cte_school_indicators(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cte_school_indicators(uuid, date) TO authenticated;
