
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStoragePolicies() {
    try {
        console.log('Relaxing Storage Policies for textbooks bucket...');

        const sql = `
            -- Drop existing restrictive Admin policies if they exist
            DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
            DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
            DROP POLICY IF EXISTS "Public Access" ON storage.objects;

            -- Create more robust policies
            -- Anyone can read from textbooks bucket
            CREATE POLICY "textbooks_public_read" 
            ON storage.objects FOR SELECT 
            USING (bucket_id = 'textbooks');

            -- Authenticated users (at least helmerpersonal) can upload to textbooks
            -- We'll try just bucket_id check first to ensure that works
            CREATE POLICY "textbooks_auth_upload" 
            ON storage.objects FOR INSERT 
            TO authenticated
            WITH CHECK (bucket_id = 'textbooks');

            -- Same for delete
            CREATE POLICY "textbooks_auth_delete" 
            ON storage.objects FOR DELETE 
            TO authenticated
            USING (bucket_id = 'textbooks');

            -- Ensure grants are correct just in case
            GRANT ALL ON TABLE storage.objects TO authenticated, anon, service_role;
            GRANT ALL ON TABLE storage.buckets TO authenticated, anon, service_role;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error applying storage fix:', error);
            process.exit(1);
        }

        console.log('Storage fix applied! Try uploading again.');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

fixStoragePolicies();
