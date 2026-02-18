
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- DIRECT SQL INSERT TEST ---')

    // We need a valid tenant and group if FKs are enforced (they are).
    // Let's first get them as we did before.
    const { data: profiles } = await supabase.from('profiles').select('tenant_id').limit(1);
    const tenantId = profiles?.[0]?.tenant_id;

    if (!tenantId) {
        console.error('No tenant found to test with.');
        return;
    }

    const { data: groups } = await supabase.from('groups').select('id').limit(1);
    const groupId = groups?.[0]?.id;

    // Use a dummy UUID if no group found (might fail FK, but we care about column error first)
    const testGroupId = groupId || '00000000-0000-0000-0000-000000000000';

    const sql = `
    INSERT INTO public.lesson_plans (
        title, tenant_id, group_id, activities_sequence, updated_at
    ) VALUES (
        'Direct SQL Test', '${tenantId}', '${testGroupId}', '[]'::jsonb, NOW()
    );
    `;

    console.log('Attempting direct SQL insert...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('SQL INSERT ERROR:', error);
    } else {
        console.log('SQL INSERT SUCCESSFUL! Database structure is correct.');
        console.log('Now checking PostgREST cache again...');
        const { error: pgrstError } = await supabase.from('lesson_plans').select('activities_sequence').limit(1);
        if (pgrstError) {
            console.error('PostgREST SELECT ERROR (Cache likely stale):', pgrstError);
        } else {
            console.log('PostgREST SELECT SUCCESSFUL! Cache is up to date.');
        }
    }
}

run()
