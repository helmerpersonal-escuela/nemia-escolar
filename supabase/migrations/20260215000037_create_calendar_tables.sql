
-- Calendar Events (SEP / Official School Calendar)
create table if not exists public.calendar_events (
  id uuid not null default gen_random_uuid (),
  title text not null,
  description text null,
  start_date date not null,
  end_date date not null,
  type text not null default 'generic', -- holiday, administrative, exam, generic
  is_official_sep boolean not null default false,
  tenant_id uuid not null references public.tenants (id),
  created_at timestamp with time zone not null default now(),
  constraint calendar_events_pkey primary key (id)
);

-- Teacher Personal Events
create table if not exists public.teacher_events (
  id uuid not null default gen_random_uuid (),
  teacher_id uuid not null references public.profiles (id),
  title text not null,
  description text null,
  start_time timestamp with time zone not null,
  end_time timestamp with time zone not null,
  tenant_id uuid not null references public.tenants (id),
  created_at timestamp with time zone not null default now(),
  constraint teacher_events_pkey primary key (id)
);

-- RLS Policies
alter table public.calendar_events enable row level security;
alter table public.teacher_events enable row level security;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_events' AND policyname = 'Enable read access for all users'
    ) THEN
        CREATE POLICY "Enable read access for all users" ON public.calendar_events for select using (true);
    END IF;
END $$;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'calendar_events' AND policyname = 'Enable insert for authenticated users only'
    ) THEN
        CREATE POLICY "Enable insert for authenticated users only" ON public.calendar_events for insert with check (auth.role () = 'authenticated');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'teacher_events' AND policyname = 'Teachers can manage their own events'
    ) THEN
        CREATE POLICY "Teachers can manage their own events" ON public.teacher_events using (auth.uid() = teacher_id);
    END IF;
END $$;
