-- Add columns to store uploaded PDF reference and extracted text

-- For Analytical Programs
ALTER TABLE "public"."analytical_programs" 
ADD COLUMN IF NOT EXISTS "source_document_url" text,
ADD COLUMN IF NOT EXISTS "extracted_text" text;

-- For Lesson Plans (Planning)
ALTER TABLE "public"."lesson_plans" 
ADD COLUMN IF NOT EXISTS "source_document_url" text,
ADD COLUMN IF NOT EXISTS "extracted_text" text;
