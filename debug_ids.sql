
-- Check what these IDs represent
SELECT 'subject_catalog' as table_name, id, name, NULL as parent_id FROM subject_catalog WHERE id IN ('7157e0b7-d255-453c-9937-1dda1c996510', 'c63901ba-b28d-43b8-8c02-b805db38643a')
UNION ALL
SELECT 'group_subjects' as table_name, id, custom_name, subject_catalog_id FROM group_subjects WHERE id IN ('7157e0b7-d255-453c-9937-1dda1c996510', 'c63901ba-b28d-43b8-8c02-b805db38643a')
UNION ALL
SELECT 'profile_subjects' as table_name, id, custom_detail, subject_catalog_id FROM profile_subjects WHERE id IN ('7157e0b7-d255-453c-9937-1dda1c996510', 'c63901ba-b28d-43b8-8c02-b805db38643a');
