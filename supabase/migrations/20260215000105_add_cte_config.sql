-- Migration: Add CTE Config to school_details
-- Description: Adds a JSONB column to store Technical Council (Consejo Técnico) configuration.

ALTER TABLE public.school_details 
ADD COLUMN IF NOT EXISTS cte_config jsonb DEFAULT '{"next_date": null, "link": null}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.school_details.cte_config IS 'Stores configuration for Technical Council: {next_date: string, link: string}';
