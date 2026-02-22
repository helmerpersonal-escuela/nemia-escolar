import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    const studentId = '8c0a8767-1601-4993-96b6-58673f808381';
    console.log(`Fixing student record for ID: ${studentId}...`);

    // 1. Check existing columns to avoid errors
    const { data: cols } = await supabase.rpc('exec_query', {
        p_sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'students'"
    });

    const colNames = cols.map((c: any) => c.column_name);
    console.log('Available columns:', colNames.join(', '));

    const updateData: any = {
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=Helmer&gender=male`
    };

    if (colNames.includes('sex')) updateData.sex = 'HOMBRE';
    else if (colNames.includes('gender')) updateData.gender = 'HOMBRE';

    const { data, error } = await supabase
        .from('students')
        .update(updateData)
        .eq('id', studentId)
        .select();

    if (error) {
        console.error('Update error:', error);
    } else {
        console.log('Update success:', JSON.stringify(data, null, 2));
    }
}

run();
