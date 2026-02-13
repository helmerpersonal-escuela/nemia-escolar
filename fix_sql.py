# Read the file
with open('c:/SistemaGestionEscolar/REPOPULAR_DEMO.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the attendance generation section
old_attendance = """-- 18. Asistencia Retrospectiva (último mes)
DELETE FROM public.attendance WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.attendance (tenant_id, group_id, student_id, date, status, notes)
SELECT 
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    s.id,
    d.date,
    CASE 
        WHEN RANDOM() < 0.85 THEN 'PRESENT'
        WHEN RANDOM() < 0.95 THEN 'LATE'
        ELSE 'ABSENT'
    END,
    NULL
FROM public.students s
CROSS JOIN (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        '1 day'::interval
    )::date AS date
    WHERE EXTRACT(DOW FROM generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        '1 day'::interval
    )) NOT IN (0, 6) -- Excluir sábados y domingos
) d
WHERE s.tenant_id = '77777777-7777-7777-7777-777777777777'
ON CONFLICT (student_id, date, group_id) DO NOTHING;"""

new_attendance = """-- 18. Asistencia Retrospectiva (último mes)
DELETE FROM public.attendance WHERE tenant_id = '77777777-7777-7777-7777-777777777777';
INSERT INTO public.attendance (tenant_id, group_id, student_id, date, status, notes)
SELECT 
    '77777777-7777-7777-7777-777777777777',
    '99999999-9999-9999-9999-999999999999',
    s.id,
    d.date,
    CASE 
        WHEN RANDOM() < 0.85 THEN 'PRESENT'
        WHEN RANDOM() < 0.95 THEN 'LATE'
        ELSE 'ABSENT'
    END,
    NULL
FROM public.students s
CROSS JOIN (
    SELECT date::date
    FROM generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        '1 day'::interval
    ) AS date
    WHERE EXTRACT(DOW FROM date) NOT IN (0, 6) -- Excluir sábados y domingos
) d
WHERE s.tenant_id = '77777777-7777-7777-7777-777777777777'
ON CONFLICT (student_id, date, group_id) DO NOTHING;"""

content = content.replace(old_attendance, new_attendance)

# Write back
with open('c:/SistemaGestionEscolar/REPOPULAR_DEMO.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed attendance generation: moved WHERE clause to reference the generated date column")
