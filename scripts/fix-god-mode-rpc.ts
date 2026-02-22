import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- REDEFINING BACK_TO_GOD_MODE ---');

    const sql = `
        CREATE OR REPLACE FUNCTION public.back_to_god_mode() 
        RETURNS void 
        LANGUAGE plpgsql 
        SECURITY DEFINER 
        SET search_path = public AS $$
        BEGIN
            -- Strictly restrict to the God account
            IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND email = 'helmerpersonal@gmail.com') THEN
                UPDATE public.profiles SET tenant_id = NULL, role = 'SUPER_ADMIN' WHERE id = auth.uid();
            ELSE 
                RAISE EXCEPTION 'Not authorized'; 
            END IF;
        END; $$;
        
        GRANT EXECUTE ON FUNCTION public.back_to_god_mode() TO authenticated;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Error redefining function:', error.message);
    } else {
        console.log('Function redefined successfully.');
    }
}

run();
