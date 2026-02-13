
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
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    console.log('Checking profiles via public tables...');

    // Check if there are profiles with names resembling the users
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name_paternal, role, tenant_id')
        .or('first_name.ilike.%Helmer%,first_name.ilike.%Mario%'); // Mario is the demo teacher name

    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    console.log('Found Profiles matching "Helmer" or "Mario":');
    console.table(profiles);

    // Check Tenants
    const { data: tenants } = await supabase.from('tenants').select('id, name, type');
    console.log('\nTenants found:');
    console.table(tenants);

    // Check Profile Tenants overlap
    if (profiles && profiles.length > 0) {
        for (const p of profiles) {
            const { data: pt } = await supabase.from('profile_tenants').select('*').eq('profile_id', p.id);
            console.log(`\nTenants for ${p.first_name} (${p.id}):`);
            console.table(pt);
        }
    }
}

checkProfiles();
