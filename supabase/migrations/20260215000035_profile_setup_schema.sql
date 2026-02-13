-- Migration: Add extended profile columns for Setup Wizard
-- Created: 2026-02-14

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nationality text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('HOMBRE', 'MUJER', 'OTRO')),
ADD COLUMN IF NOT EXISTS marital_status text,
ADD COLUMN IF NOT EXISTS curp text,
ADD COLUMN IF NOT EXISTS rfc text,
ADD COLUMN IF NOT EXISTS address_particular text,
ADD COLUMN IF NOT EXISTS phone_contact text,
ADD COLUMN IF NOT EXISTS profile_setup_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Update RLS policies to allow updating these new columns
-- (Existing policy "Users can update own profile" should already cover this as it allows updates to own row)
