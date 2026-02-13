
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.resolve(__dirname, '.env');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

// Use Service Role if available in secrets.json for higher privileges, otherwise try anon (which might fail if RLS blocks it, but RPC is typically SECURITY DEFINER)
let serviceRole = null;
try {
    const secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'));
    serviceRole = secrets.SUPABASE_SERVICE_ROLE_KEY;
} catch (e) {
    console.log('No secrets.json found, using anon key');
}

const supabase = createClient(supabaseUrl, serviceRole || supabaseKey);

async function applyMigration() {
    console.log('Applying migration 20260215000089_decouple_profiles.sql...');

    const migrationFile = path.join(__dirname, 'supabase', 'migrations', '20260215000089_decouple_profiles.sql');
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');

    // Split by statement logic is tricky for PL/PGSQL blocks ($$). 
    // We should try to execute the whole thing if `exec_sql` supports it, 
    // OR split by standard semicolon but respect the $$ blocks.

    // For safety, let's just try to Execute the WHOLE string first. 
    // Postgres often handles multiple statements in one query string.

    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
        console.error('Error executing migration:', error);
        // Fallback: simple split if 'cannot insert multiple commands' error
    } else {
        console.log('✅ Migration applied successfully!');
    }
}

applyMigration();
