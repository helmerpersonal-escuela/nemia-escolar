-- Migration: Soft Delete and Email Release System
-- This allows users to "delete" their account while freeing their email for new registration.
-- It also enables a 24h+ recovery window for SuperAdmins.

-- 1. Add deleted_at column to profiles
alter table public.profiles add column if not exists deleted_at timestamp with time zone;

-- 2. Function to Soft Delete an account
-- Renames the email in auth.users to release the original address.
create or replace function public.soft_delete_account(target_user_id uuid)
returns void
language plpgsql
security definer -- Runs with elevated privileges to modify auth.users
as $$
declare
    current_email text;
    new_email text;
begin
    -- 1. Get current email
    select email into current_email from auth.users where id = target_user_id;

    -- 2. Create a "tombstone" email to release the original one
    new_email := current_email || '.deleted.' || floor(extract(epoch from now())) || '@internal.edu';

    -- 3. Update auth.users (renaming releases the unique constraint on original email)
    update auth.users 
    set email = new_email, 
        raw_user_meta_data = raw_user_meta_data || jsonb_build_object('deleted_original_email', current_email)
    where id = target_user_id;

    -- 4. Mark profile as deleted
    update public.profiles 
    set deleted_at = now()
    where id = target_user_id;
end;
$$;

-- 3. Function to Restore an account
create or replace function public.restore_account(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    original_email text;
begin
    -- 1. Get original email from metadata
    select (raw_user_meta_data->>'deleted_original_email') into original_email 
    from auth.users where id = target_user_id;

    if original_email is null then
        raise exception 'Could not find original email for restoration.';
    end if;

    -- 2. Restore email in auth.users (Will fail if original email is now taken by another account)
    update auth.users 
    set email = original_email,
        raw_user_meta_data = raw_user_meta_data - 'deleted_original_email'
    where id = target_user_id;

    -- 3. Unmark profile
    update public.profiles 
    set deleted_at = null
    where id = target_user_id;
end;
$$;

-- 4. Function to Purge (Permanent Delete) - NUCLEAR VERSION
-- Handles all known dependencies to avoid FK errors.
create or replace function public.purge_account(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
    target_tenant_id uuid;
begin
    -- 1. Get tenant_id
    select tenant_id into target_tenant_id from public.profiles where id = target_user_id;

    if target_tenant_id is not null then
        -- 2. Delete data in order of dependency (Leaf to Root)
        
        -- Level 5 (Deep dependencies)
        delete from public.rubric_descriptors where criterion_id in (select id from public.rubric_criteria where rubric_id in (select id from public.rubrics where tenant_id = target_tenant_id));
        delete from public.rubric_criteria where rubric_id in (select id from public.rubrics where tenant_id = target_tenant_id);
        delete from public.rubric_levels where rubric_id in (select id from public.rubrics where tenant_id = target_tenant_id);

        -- Level 4 (Secondary dependencies)
        delete from public.grades where tenant_id = target_tenant_id;
        delete from public.attendance where tenant_id = target_tenant_id;
        delete from public.schedules where tenant_id = target_tenant_id;
        delete from public.formative_records where tenant_id = target_tenant_id;
        delete from public.evidence_portfolio where tenant_id = target_tenant_id;
        delete from public.student_incidents where tenant_id = target_tenant_id;
        delete from public.student_bap_records where tenant_id = target_tenant_id;
        delete from public.teacher_events where tenant_id = target_tenant_id;
        delete from public.calendar_events where tenant_id = target_tenant_id;
        
        -- Level 3: Middle dependencies
        delete from public.evaluation_criteria where tenant_id = target_tenant_id;
        delete from public.evaluation_criteria_catalog where tenant_id = target_tenant_id;
        delete from public.assignments where tenant_id = target_tenant_id;
        delete from public.students where tenant_id = target_tenant_id;
        delete from public.lesson_plans where tenant_id = target_tenant_id;
        delete from public.rubrics where tenant_id = target_tenant_id;
        
        -- Level 2: Core school entities
        delete from public.profile_subjects where tenant_id = target_tenant_id;
        delete from public.evaluation_periods where tenant_id = target_tenant_id;
        delete from public.schedule_settings where tenant_id = target_tenant_id;
        delete from public.groups where tenant_id = target_tenant_id;
        delete from public.academic_years where tenant_id = target_tenant_id;
        
        -- 3. Delete Profiles
        delete from public.profiles where tenant_id = target_tenant_id;

        -- 4. Delete Tenant
        delete from public.tenants where id = target_tenant_id;
    end if;

    -- 5. Delete Auth User
    delete from auth.users where id = target_user_id;
end;
$$;

-- 5. Function to Purge by Email (for cleanup of blocked registrations)
create or replace function public.purge_auth_user_by_email(target_email text)
returns void
language plpgsql
security definer
as $$
declare
    target_user_id uuid;
begin
    -- 1. Find user ID by email in auth.users (case-insensitive)
    select id into target_user_id from auth.users where lower(email) = lower(target_email);

    if target_user_id is not null then
        -- 2. Call the existing purge function
        perform public.purge_account(target_user_id);
    else
        raise exception 'User with email % not found in auth system.', target_email;
    end if;
end;
$$;
