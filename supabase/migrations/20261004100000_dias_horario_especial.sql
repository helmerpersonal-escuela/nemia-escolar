-- Días con horario especial: un día o un rango, y qué pasa con las clases.
--   SHORTENED  = clases más cortas (nueva entrada/salida y duración de módulo)
--   BLOCKED    = se suspenden algunas horas (blocked_ranges: [{start, end, label}])
--   NO_CLASSES = no hay clases en todo el día
alter table public.special_schedule_structure
    add column if not exists end_date date,
    add column if not exists mode text not null default 'SHORTENED',
    add column if not exists blocked_ranges jsonb not null default '[]'::jsonb,
    add column if not exists note text,
    add column if not exists created_by uuid references public.profiles(id) on delete set null;

alter table public.special_schedule_structure
    alter column start_time drop not null,
    alter column end_time drop not null,
    alter column module_duration drop not null;

update public.special_schedule_structure set end_date = target_date where end_date is null;
alter table public.special_schedule_structure alter column end_date set not null;

alter table public.special_schedule_structure drop constraint if exists special_schedule_structure_tenant_id_target_date_key;
alter table public.special_schedule_structure drop constraint if exists special_schedule_mode_check;
alter table public.special_schedule_structure add constraint special_schedule_mode_check check (mode in ('SHORTENED', 'BLOCKED', 'NO_CLASSES'));
alter table public.special_schedule_structure drop constraint if exists special_schedule_range_check;
alter table public.special_schedule_structure add constraint special_schedule_range_check check (end_date >= target_date);
alter table public.special_schedule_structure drop constraint if exists special_schedule_shortened_check;
alter table public.special_schedule_structure add constraint special_schedule_shortened_check
    check (mode <> 'SHORTENED' or (start_time is not null and end_time is not null and module_duration > 0));

create index if not exists special_schedule_tenant_range_idx
    on public.special_schedule_structure (tenant_id, target_date, end_date);

-- Solo dirección / coordinación / docente independiente pueden crear o cambiar días especiales;
-- todos los del espacio pueden verlos.
drop policy if exists "Admins can manage special schedules" on public.special_schedule_structure;
create policy "Admins can manage special schedules" on public.special_schedule_structure
    for all
    using (tenant_id = public.get_current_tenant_id()
           and upper(coalesce(public.current_tenant_role(), '')) in ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'))
    with check (tenant_id = public.get_current_tenant_id()
           and upper(coalesce(public.current_tenant_role(), '')) in ('DIRECTOR', 'ADMIN', 'SUPER_ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'INDEPENDENT_TEACHER'));
