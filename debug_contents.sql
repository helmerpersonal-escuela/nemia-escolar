
-- Check Analytical Programs and their Contents
SELECT 
    ap.id as program_id,
    ap.school_data->>'grades' as grades,
    apc.subject_id,
    sc.name as subject_name,
    apc.custom_content
FROM analytical_programs ap
LEFT JOIN analytical_program_contents apc ON ap.id = apc.program_id
LEFT JOIN subject_catalog sc ON apc.subject_id = sc.id
WHERE ap.tenant_id = (SELECT id FROM tenants LIMIT 1);
