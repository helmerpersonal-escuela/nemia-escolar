-- Drop the unique constraint that prevents creating multiple groups with same grade/section/shift
-- This is necessary to support Technology Workshops where we have multiple "1° A" groups but with different subjects (Robotics, Informatics, etc.)

ALTER TABLE "public"."groups" DROP CONSTRAINT IF EXISTS "groups_tenant_id_academic_year_id_grade_section_shift_key";
