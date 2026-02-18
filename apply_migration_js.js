
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Try to get service role key for admin privileges if available, otherwise fallback to anon (might fail RLS)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Supabase URL or Key not found in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const migrationFile = 'supabase/migrations/20260215000123_add_license_keys.sql';

async function applyMigration() {
    try {
        const sql = fs.readFileSync(migrationFile, 'utf8');
        console.log(`Applying migration: ${migrationFile}`);

        // Split SQL by statement (basic split by semicolon, might need more robust parsing if complex)
        // But supabase-js rpc usually takes one function. 
        // Wait, supabase-js doesn't have a direct "exec_sql" unless we added one. 
        // Let's check if we have an `exec_sql` RPC from previous migrations.

        // Trying to call a potentially existing 'exec_sql' or 'exec' function
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // If exec_sql doesn't exist, we might be stuck without direct SQL access via JS SDK.
            // But we saw `20260215000114_add_exec_sql.sql` in the file list earlier!
            console.error('Error executing migration via RPC:', error);

            // Fallback: try `exec` if `exec_sql` name was different
            const { data: data2, error: error2 } = await supabase.rpc('exec', { query: sql });
            if (error2) {
                console.error('Error executing migration via fallback RPC:', error2);
                process.exit(1);
            }
        }

        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Unexpected error:', err);
        process.exit(1);
    }
}

applyMigration();
