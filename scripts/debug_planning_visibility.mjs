
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

async function inspect() {
    const results = {};
    const { data: plans } = await supabase.from('lesson_plans').select('*, evaluation_periods(name)').eq('group_id', groupId);
    results.plans = plans || [];
    const { data: periods } = await supabase.from('evaluation_periods').select('*').order('start_date');
    results.periods = periods || [];
    results.today = new Date().toISOString().split('T')[0];
    const { data: gSubjects } = await supabase.from('group_subjects').select('*, subject_catalog(name)').eq('group_id', groupId);
    results.groupSubjects = gSubjects || [];
    fs.writeFileSync('debug_output.json', JSON.stringify(results, null, 2));
    console.log('Results written to debug_output.json');
}
inspect();
