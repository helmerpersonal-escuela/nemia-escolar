
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key not found in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationFile = 'supabase/migrations/20260215001100_create_textbooks_schema.sql';

async function fixMissingTable() {
    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log(`Applying migration: ${migrationFile}`);

        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('Error executing migration via RPC:', error);
            process.exit(1);
        }

        console.log('Migration applied successfully via exec_sql!');
    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

fixMissingTable();
