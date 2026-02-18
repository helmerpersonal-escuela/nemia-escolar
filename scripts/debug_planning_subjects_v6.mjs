
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const results = {};
    const { data: gs } = await supabase
        .from('group_subjects')
        .select('*, subject_catalog(name)')
        .ilike('custom_name', '%ESPAÑOL%');
    results.groupSubjects = gs || [];

    // Also check subject_catalog for "Español"
    const { data: catalog } = await supabase
        .from('subject_catalog')
        .select('*')
        .ilike('name', '%ESPAÑOL%');
    results.catalog = catalog || [];

    fs.writeFileSync('debug_output_v6.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v6.json');
}
inspect();
