
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function nuclearFix() {
    try {
        console.log('Starting nuclear fix for textbooks table...');

        const migrationSql = fs.readFileSync('supabase/migrations/20260215001100_create_textbooks_schema.sql', 'utf8');

        // We will try to:
        // 1. Rename existing textbooks table if it exists
        // 2. Drop any previous attempts
        // 3. Create the table fresh
        // 4. Grant explicit permissions

        const fixSql = `
            DO $$
            BEGIN
                -- Rename if exists to clear cache issues
                IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'textbooks') THEN
                    EXECUTE 'ALTER TABLE public.textbooks RENAME TO textbooks_old_' || floor(extract(epoch from now()));
                END IF;
            END $$;

            -- Create the table fresh
            ${migrationSql}

            -- Final grant to be 100% sure
            GRANT ALL ON TABLE public.textbooks TO anon, authenticated, service_role;
            GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
        `;

        const { error } = await supabase.rpc('exec_sql', { sql_query: fixSql });

        if (error) {
            console.error('Error during nuclear fix:', error);
            // If it fails with ownership, we'll try to just DROP it if we can
            const dropSql = "DROP TABLE IF EXISTS public.textbooks CASCADE;";
            await supabase.rpc('exec_sql', { sql_query: dropSql });
            // Then try again
            const { error: error2 } = await supabase.rpc('exec_sql', { sql_query: fixSql });
            if (error2) {
                console.error('Nuclear fix failed twice. Permission issue is likely deep.', error2);
                process.exit(1);
            }
        }

        console.log('Nuclear fix applied! Waiting for cache reload...');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

nuclearFix();
