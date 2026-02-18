
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const results = {};

    // Check all groups
    const { data: groups, error: gError } = await supabase.from('groups').select('*').limit(50);
    results.groups = groups || [];
    results.groupsError = gError;

    // Check all tenants
    const { data: tenants, error: tError } = await supabase.from('tenants').select('*').limit(10);
    results.tenants = tenants || [];
    results.tenantsError = tError;

    // Check all lesson plans (first 5 to see structure)
    const { data: plans, error: pError } = await supabase.from('lesson_plans').select('*').limit(5);
    results.anyPlans = plans || [];
    results.plansError = pError;

    fs.writeFileSync('debug_output_v2.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v2.json');
}
inspect();
