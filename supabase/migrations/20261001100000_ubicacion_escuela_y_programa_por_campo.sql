-- Ubicación de la escuela con claves INEGI (catálogo SEPOMEX en /public/geo)
alter table public.school_details
  add column if not exists address_state_code text,
  add column if not exists address_municipality_code text;

-- Un programa analítico por campo formativo (y por docente en espacios de escuela)
alter table public.analytical_programs
  add column if not exists field_of_study text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null;

create index if not exists analytical_programs_tenant_field_idx
  on public.analytical_programs (tenant_id, field_of_study);

comment on column public.analytical_programs.field_of_study is
  'Campo formativo del programa (Lenguajes | Saberes y Pensamiento Científico | Ética, Naturaleza y Sociedades | De lo Humano y lo Comunitario). NULL = programa anterior con varios campos.';
