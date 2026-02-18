
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
    console.log('--- UPDATING LICENSE LIMITS ---')

    const sql = `
    -- Ensure table exists if not already recreated
    CREATE TABLE IF NOT EXISTS public.license_limits (
        plan_type TEXT PRIMARY KEY,
        max_groups INTEGER NOT NULL,
        max_students_per_group INTEGER NOT NULL,
        price_annual DECIMAL(10,2) NOT NULL,
        trial_days INTEGER DEFAULT 30,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE public.license_limits ENABLE ROW LEVEL SECURITY;

    -- Policy
    DROP POLICY IF EXISTS "Anyone can view license limits" ON public.license_limits;
    CREATE POLICY "Anyone can view license limits" ON public.license_limits 
    FOR SELECT TO authenticated, anon USING (true);

    -- Update/Insert limits
    INSERT INTO public.license_limits (plan_type, max_groups, max_students_per_group, price_annual, trial_days) 
    VALUES 
        ('basic', 5, 50, 399, 30), 
        ('pro', 10, 100, 999, 30) 
    ON CONFLICT (plan_type) DO UPDATE SET 
        max_groups = EXCLUDED.max_groups, 
        max_students_per_group = EXCLUDED.max_students_per_group,
        price_annual = EXCLUDED.price_annual,
        updated_at = NOW();

    -- Reload
    NOTIFY pgrst, 'reload config';
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error updating limits:', error);
    } else {
        console.log('License limits updated successfully!');
    }
}

run()
