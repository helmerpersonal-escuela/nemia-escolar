
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase Environment Variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc';

async function inspect() {
    console.log(`Inspecting lesson plans for group: ${groupId}`);

    // 1. Check lesson_plans table
    const { data: plans, error: plansError } = await supabase
        .from('lesson_plans')
        .select('*, evaluation_periods(id, name)')
        .eq('group_id', groupId);

    if (plansError) {
        console.error('Error fetching plans:', plansError);
    } else {
        console.log(`Found ${plans.length} plans:`);
        plans.forEach(p => {
            console.log(`- ID: ${p.id}, SubjectID: ${p.subject_id}, Period: ${p.evaluation_periods?.name} (${p.period_id}), Created: ${p.created_at}`);
        });
    }

    // 2. Check current period
    const today = new Date().toISOString().split('T')[0];
    const { data: periods, error: periodsError } = await supabase
        .from('evaluation_periods')
        .select('*')
        .order('start_date');

    if (periodsError) {
        console.error('Error fetching periods:', periodsError);
    } else {
        const active = periods.find(p => today >= p.start_date && today <= p.end_date) || periods[0];
        console.log(`Active Period: ${active?.name} (${active?.id}) [${active?.start_date} to ${active?.end_date}]`);
    }

    // 3. Check group_subjects
    const { data: gSubjects, error: gsError } = await supabase
        .from('group_subjects')
        .select('*, subject_catalog(name)')
        .eq('group_id', groupId);

    if (gsError) {
        console.error('Error fetching group subjects:', gsError);
    } else {
        console.log('Group Subjects:');
        gSubjects.forEach(gs => {
            console.log(`- ID: ${gs.id}, CatalogID: ${gs.subject_catalog_id}, Name: ${gs.subject_catalog?.name || gs.custom_name}`);
        });
    }
}

inspect();
