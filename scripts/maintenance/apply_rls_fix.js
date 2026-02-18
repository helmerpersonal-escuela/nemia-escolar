import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env
const envPath = path.resolve(__dirname, '.env');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
    console.log('Applying RLS fix...');

    const sqlStatements = [
        `ALTER TABLE public.guardians ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)`,

        `UPDATE public.guardians 
         SET tenant_id = (SELECT tenant_id FROM public.students WHERE students.id = guardians.student_id)
         WHERE tenant_id IS NULL`,

        `DROP POLICY IF EXISTS "Users can view guardians in own tenant" ON public.guardians`,

        `DROP POLICY IF EXISTS "Admins/Teachers can manage guardians" ON public.guardians`,

        `CREATE POLICY "Users can view guardians in own tenant" ON public.guardians 
         FOR SELECT USING (
             tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
         )`,

        `CREATE POLICY "Admins/Teachers can manage guardians" ON public.guardians 
         FOR ALL USING (
             tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
         )`
    ];

    for (let i = 0; i < sqlStatements.length; i++) {
        console.log(`\nExecuting statement ${i + 1}/${sqlStatements.length}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: sqlStatements[i] });

        if (error) {
            console.error(`Error on statement ${i + 1}:`, error);
            console.log('Statement was:', sqlStatements[i]);
        } else {
            console.log(`✓ Statement ${i + 1} executed successfully`);
        }
    }

    console.log('\n✅ RLS fix applied! Please reload the StudentDashboard.');
}

applyFix();
