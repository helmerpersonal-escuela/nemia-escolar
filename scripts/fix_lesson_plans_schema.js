
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function applyFix() {
    console.log('Applying schema fix to lesson_plans...')

    const sql = `
    DO $$
    BEGIN
        -- Add missing columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'title') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN title TEXT DEFAULT 'Sin Título';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'temporality') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN temporality TEXT CHECK (temporality IN ('WEEKLY', 'MONTHLY', 'PROJECT'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'start_date') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN start_date DATE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'campo_formativo') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN campo_formativo TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'metodologia') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN metodologia TEXT;
        END IF;

        -- Ensure tenant_id exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
        END IF;

        -- Ensure group_id exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lesson_plans' AND column_name = 'group_id') THEN
            ALTER TABLE public.lesson_plans ADD COLUMN group_id UUID REFERENCES public.groups(id);
        END IF;

        -- Reload schema cache
        NOTIFY pgrst, 'reload config';
    END $$;
  `

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql })

    if (error) {
        console.error('Error applying fix:', error)
    } else {
        console.log('Schema fix applied successfully!')
    }
}

applyFix()
