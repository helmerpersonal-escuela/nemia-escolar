-- Create a new bucket 'school-assets' if it doesn't exist
insert into storage.buckets (id, name, public)
values ('school-assets', 'school-assets', true)
on conflict (id) do nothing;

-- Set up security policies for the bucket with UNIQUE names to avoid conflicts

-- 1. Allow public read access (Unique name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access school-assets'
    ) THEN
        CREATE POLICY "Public Access school-assets" ON storage.objects for select
  using ( bucket_id = 'school-assets' );
    END IF;
END $$;

-- 2. Allow authenticated users to upload images (Unique name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth upload school-assets'
    ) THEN
        CREATE POLICY "Auth upload school-assets" ON storage.objects for insert
  to authenticated
  with check ( bucket_id = 'school-assets' );
    END IF;
END $$;

-- 3. Allow users to update/delete their own uploads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth update own school-assets'
    ) THEN
        CREATE POLICY "Auth update own school-assets" ON storage.objects for update
  to authenticated
  using ( bucket_id = 'school-assets' and auth.uid() = owner );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth delete own school-assets'
    ) THEN
        CREATE POLICY "Auth delete own school-assets" ON storage.objects for delete
  to authenticated
  using ( bucket_id = 'school-assets' and auth.uid() = owner );
    END IF;
END $$;
