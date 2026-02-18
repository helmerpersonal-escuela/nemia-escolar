
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- Fetching Evaluation Periods ---');
    const { data: periods, error } = await supabase
        .from('evaluation_periods')
        .select('*')
        .order('start_date');

    if (error) {
        console.error('Error:', error);
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    console.log(`Today is: ${today}`);
    console.log('Periods:', JSON.stringify(periods, null, 2));

    const activePeriod = periods.find(p => today >= p.start_date && today <= p.end_date);
    console.log('Active Period by Date:', activePeriod?.name || 'NONE');

    fs.writeFileSync('evaluation_periods_debug.json', JSON.stringify({ today, periods, activePeriod }, null, 2));
}

run()
