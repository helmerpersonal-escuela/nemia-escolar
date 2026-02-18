
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
    const results = {};
    const { data: groups } = await supabase.from('groups').select('*').ilike('section', '%Aula Privada%');
    results.groupsBySection = groups || [];

    fs.writeFileSync('debug_output_v4.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v4.json');
}
inspect();
