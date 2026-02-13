
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
// We need Service Role to query auth.users or check emails directly via admin API if possible, 
// OR we can query profiles and look for names.
let serviceRole = null;
try {
    const secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'));
    serviceRole = secrets.SUPABASE_SERVICE_ROLE_KEY;
} catch (e) {
    console.log('No secrets.json found');
}

const supabase = createClient(supabaseUrl, serviceRole || envConfig.VITE_SUPABASE_ANON_KEY);

async function checkLinkage() {
    console.log('Checking for account linkage...');

    // 1. Get IDs for potentially relevant emails (if we can, usually restricted)
    // We can't query auth.users directly with client unless we have service role. 
    // If we have service role, we can do it.

    if (serviceRole) {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (users) {
            const helmer = users.find(u => u.email === 'helmerferras@gmail.com');
            const docente = users.find(u => u.email === 'docente@escuelademonh.com');

            console.log('Helmer ID:', helmer?.id);
            console.log('Docente ID:', docente?.id);

            if (helmer && docente) {
                if (helmer.id === docente.id) {
                    console.error('CRITICAL: Emails share the same User ID!');
                } else {
                    console.log('✅ User IDs are different.');
                }

                // Check Profiles
                const { data: hProfile } = await supabase.from('profiles').select('*').eq('id', helmer.id).single();
                const { data: dProfile } = await supabase.from('profiles').select('*').eq('id', docente.id).single();

                console.log('Helmer Profile:', hProfile);
                console.log('Docente Profile:', dProfile);

                // Check Profile Tenants
                const { data: hTenants } = await supabase.from('profile_tenants').select('*').eq('profile_id', helmer.id);
                const { data: dTenants } = await supabase.from('profile_tenants').select('*').eq('profile_id', docente.id);

                console.log('Helmer Tenants:', hTenants);
                console.log('Docente Tenants:', dTenants);
            } else {
                console.log('One or both users not found in Auth.');
            }
        }
    } else {
        console.log('Service Role not available, cannot check auth.users directly.');
        // Can try to find profiles by some other means or just trust the user.
    }
}

checkLinkage();
