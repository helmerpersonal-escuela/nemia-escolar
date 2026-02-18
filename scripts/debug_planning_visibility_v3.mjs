
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = "https://aveqziaewxcglhteufft.supabase.co";
const supabaseAnonKey = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J";

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

async function inspect() {
    const results = {};
    const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
    results.group = group;

    if (group) {
        const { data: plans } = await supabase.from('lesson_plans').select('*, evaluation_periods(name)').eq('group_id', groupId);
        results.plans = plans || [];
        const { data: periods } = await supabase.from('evaluation_periods').select('*').order('start_date');
        results.periods = periods || [];
        const { data: gSubjects } = await supabase.from('group_subjects').select('*, subject_catalog(name)').eq('group_id', groupId);
        results.groupSubjects = gSubjects || [];
    }

    fs.writeFileSync('debug_output_v3.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output_v3.json');
}
inspect();
