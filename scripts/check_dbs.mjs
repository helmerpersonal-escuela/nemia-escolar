
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const db1 = {
    url: "https://aveqziaewxcglhteufft.supabase.co",
    key: "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J"
};

const db2 = {
    url: "https://xgrwivblrrucucjhrmni.supabase.co",
    key: "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J" // Likely same anon key if it's a clone or shared env
};

async function test(db, label) {
    const supabase = createClient(db.url, db.key);
    const results = { label };

    // Check tenants
    const { data: tenants } = await supabase.from('tenants').select('id, name').limit(5);
    results.tenants = tenants || [];

    // Check groups
    const { data: groups } = await supabase.from('groups').select('id, grade, section').limit(10);
    results.groups = groups || [];

    // Check lesson plans
    const { data: plans } = await supabase.from('lesson_plans').select('id, title, group_id').limit(5);
    results.plans = plans || [];

    return results;
}

async function run() {
    const r1 = await test(db1, 'aveqziaew');
    const r2 = await test(db2, 'xgrwivb');

    fs.writeFileSync('db_check.json', JSON.stringify({ r1, r2 }, null, 2));
}
run();
