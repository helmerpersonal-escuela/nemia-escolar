
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
    try {
        console.log('Setting up storage bucket...');

        const sql = `
            -- 1. Create bucket if missing (permission might be different for storage.buckets)
            INSERT INTO storage.buckets (id, name, public) 
            VALUES ('textbooks', 'textbooks', true)
            ON CONFLICT (id) DO NOTHING;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error creating bucket:', error);
            console.log('Note: If this fails, the bucket might already exist or requires manual creation.');
        } else {
            console.log('Bucket "textbooks" confirmed/created.');
        }

        console.log('Attempting to apply storage policies...');
        const policySql = `
            -- These might fail if not owner of storage.objects
            DO $$
            BEGIN
                BEGIN
                    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'textbooks');
                EXCEPTION WHEN OTHERS THEN 
                    RAISE NOTICE 'Policy Public Access might already exist or permission denied';
                END;
                
                BEGIN
                    CREATE POLICY "Admin Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'textbooks' AND auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com');
                EXCEPTION WHEN OTHERS THEN 
                    RAISE NOTICE 'Policy Admin Upload might already exist or permission denied';
                END;

                BEGIN
                    CREATE POLICY "Admin Delete" ON storage.objects FOR DELETE USING (bucket_id = 'textbooks' AND auth.jwt() ->> 'email' = 'helmerpersonal@gmail.com');
                EXCEPTION WHEN OTHERS THEN 
                    RAISE NOTICE 'Policy Admin Delete might already exist or permission denied';
                END;
            END $$;
        `;

        const { error: pError } = await supabase.rpc('exec_sql', { sql_query: policySql });
        if (pError) {
            console.error('Failed to apply storage policies via SQL. This usually requires Supabase Dashboard access.');
        } else {
            console.log('Storage policies applied successfully!');
        }

    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

setupStorage();
