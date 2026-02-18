
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase URL or Anon Key')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function fixFK() {
    console.log('Attempting to recreate Foreign Key lesson_plans -> groups...')

    const sql = `
    DO $$
    BEGIN
        -- Drop if exists (to be safe and clean)
        ALTER TABLE public.lesson_plans DROP CONSTRAINT IF EXISTS lesson_plans_group_id_fkey;
        
        -- Add explicit constraint
        ALTER TABLE public.lesson_plans 
        ADD CONSTRAINT lesson_plans_group_id_fkey 
        FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;
        
        -- Reload schema cache
        NOTIFY pgrst, 'reload config';
    END $$;
  `

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        console.error('Error executing SQL:', error)
    } else {
        console.log('Success! Foreign Key recreated and schema cache reloaded.')
    }
}

fixFK()
