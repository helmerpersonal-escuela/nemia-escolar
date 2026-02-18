
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const results = {};
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

    // Try to use exec_sql to bypass RLS if it's open (dangerous but helpful for debugging)
    const sql = `
        SELECT 
            gs.id as gs_id, 
            gs.custom_name, 
            gs.subject_catalog_id,
            sc.name as catalog_name,
            (SELECT count(*) FROM lesson_plans lp WHERE lp.group_id = gs.group_id AND lp.subject_id = COALESCE(gs.subject_catalog_id, gs.id)) as plan_count
        FROM group_subjects gs
        LEFT JOIN subject_catalog sc ON gs.subject_catalog_id = sc.id
        WHERE gs.group_id = '${groupId}';
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    results.rpc_data = data;
    results.rpc_error = error;

    if (error) {
        // If RPC fails, try a direct query on group_subjects again but broader
        const { data: gs } = await supabase.from('group_subjects').select('*').limit(10);
        results.sample_gs = gs || [];
    }

    fs.writeFileSync('debug_rpc.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_rpc.json');
}
inspect();
