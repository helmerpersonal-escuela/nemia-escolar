import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.resolve(__dirname, '.env');
let envConfig = {};
try {
    envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) acc[key.trim()] = value.trim();
        return acc;
    }, {});
} catch (e) {
    console.error("Could not read .env file");
}

const supabaseUrl = envConfig.VITE_SUPABASE_URL || 'https://aveqziaewxcglhteufft.supabase.co';
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
    console.log('Applying delete_own_account fix...');

    const migrationPath = path.resolve(__dirname, 'supabase/migrations/20260215000122_fix_delete_account_final_order.sql');
    let sqlContent = '';
    try {
        sqlContent = fs.readFileSync(migrationPath, 'utf8');
    } catch (e) {
        console.error("Could not read migration file:", migrationPath);
        process.exit(1);
    }

    console.log(`Executing SQL from ${path.basename(migrationPath)}...`);

    // The RPC expects a single string. 
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
        console.error(`Error executing SQL:`, error);
    } else {
        console.log(`✓ Migration applied successfully`);
    }
}

applyFix();
