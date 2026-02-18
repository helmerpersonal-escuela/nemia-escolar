
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkLessonPlans() {
    console.log('Fetching lesson plans...');
    const { data, error } = await supabase
        .from('lesson_plans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Recent Lesson Plans:', JSON.stringify(data, null, 2));
    fs.writeFileSync('recent_lesson_plans.json', JSON.stringify(data, null, 2));
}

checkLessonPlans();
