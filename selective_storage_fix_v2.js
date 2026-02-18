
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function selectiveStorageFix() {
    try {
        console.log('Applying selective storage fix...');

        const sql = `
            DO $$
            BEGIN
                -- Drop any textbook related policies to start clean
                DROP POLICY IF EXISTS "Admin Upload" ON storage.objects;
                DROP POLICY IF EXISTS "Admin Delete" ON storage.objects;
                DROP POLICY IF EXISTS "Public Access" ON storage.objects;
                DROP POLICY IF EXISTS "textbooks_public_read" ON storage.objects;
                DROP POLICY IF EXISTS "textbooks_auth_upload" ON storage.objects;
                DROP POLICY IF EXISTS "textbooks_auth_delete" ON storage.objects;

                -- CREATE NEW POLICIES
                CREATE POLICY "textbooks_read_all" ON storage.objects FOR SELECT USING (bucket_id = 'textbooks');
                CREATE POLICY "textbooks_insert_auth" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'textbooks');
                CREATE POLICY "textbooks_delete_auth" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'textbooks');
            END $$;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error in selective storage fix:', error);
            process.exit(1);
        }

        console.log('Selective storage fix applied successfully!');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

selectiveStorageFix();
