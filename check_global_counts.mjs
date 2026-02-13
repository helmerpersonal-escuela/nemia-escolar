
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let envKey = '';
let supabaseUrl = 'https://aveqziaewxcglhteufft.supabase.co'; // Default fallback

try {
    const envFile = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');

    const matchKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
    if (matchKey) envKey = matchKey[1].trim();

    const matchUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/);
    if (matchUrl) supabaseUrl = matchUrl[1].trim();

} catch (e) {
    console.log('No .env found, using hardcoded fallback from previous scripts if any...');
}

const supabase = createClient(supabaseUrl, envKey || 'YOUR_KEY_HERE')

async function checkAllCounts() {
    console.log('--- Checking Global Counts (Verification of Population) ---')
    console.log('URL:', supabaseUrl)

    const tables = ['profiles', 'tenants', 'groups', 'students', 'subjects', 'assignments', 'grades', 'attendance', 'lesson_plans', 'analytical_programs']
    const results = {}

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })

        if (error) {
            results[table] = `ERROR: ${error.message}`
        } else {
            results[table] = count
        }
    }

    console.log(JSON.stringify(results, null, 2))

    // Check specific demo users - selecting safer columns
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, role, tenant_id') // removed email just in case
        .or('id.eq.57574904-e864-498c-b0a6-e0a14359d162')

    console.log('\n--- Specific Users ---')
    if (userError) console.error(JSON.stringify(userError, null, 2))
    else console.log(JSON.stringify(users, null, 2))
}

checkAllCounts()
