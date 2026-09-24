-- Migration: Create Lesson Plan Templates Table
create table if not exists public.lesson_plan_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  educational_level text not null check (educational_level in ('PRIMARY', 'SECONDARY', 'TELESECUNDARIA')),
  grade integer not null,
  subject_name text,
  campo_formativo text,
  metodologia text default 'Aprendizaje Basado en Proyectos Community',
  purpose text,
  pda text[] default '{}',
  activities_sequence jsonb default '[]',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.lesson_plan_templates enable row level security;

-- Policies
create policy "Everyone can read templates"
  on public.lesson_plan_templates for select using (auth.role() = 'authenticated');

-- Indexes
create index if not exists idx_templates_level_grade on public.lesson_plan_templates(educational_level, grade);
create index if not exists idx_templates_subject on public.lesson_plan_templates(subject_name);
