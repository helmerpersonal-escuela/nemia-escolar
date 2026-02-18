import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://xgrwivblrrucucjhrmni.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_LyBk7Vr49y7qxrtfS6EVsg_WjxCXsoy";

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data: groups } = await supabase.from('groups').select('id, grade, section');
    const { data: subjects } = await supabase.from('group_subjects').select('id, custom_name, subject_catalog_id, group_id');
    console.log('GROUPS:', JSON.stringify(groups, null, 2));
    console.log('SUBJECTS:', JSON.stringify(subjects, null, 2));
}

check();
