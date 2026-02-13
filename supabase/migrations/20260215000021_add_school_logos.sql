-- Add logo columns to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_left_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS logo_right_url text;
