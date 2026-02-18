-- Create special_schedule_structure table
create table if not exists public.special_schedule_structure (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants not null,
  target_date date not null,
  name text not null, -- e.g., "Acto Cívico", "Festival", "Reunión de Consejo Técnico"
  start_time time not null,
  end_time time not null,
  module_duration integer not null, -- duration in minutes
  breaks jsonb default '[]'::jsonb, -- Array of {name, start_time, end_time}
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(tenant_id, target_date)
);

-- Enable RLS
alter table public.special_schedule_structure enable row level security;

-- Policies
create policy "Users can view special schedules in own tenant"
  on public.special_schedule_structure for select
  using (tenant_id = get_current_tenant_id());

create policy "Admins can manage special schedules"
  on public.special_schedule_structure for all
  using (tenant_id = get_current_tenant_id());
