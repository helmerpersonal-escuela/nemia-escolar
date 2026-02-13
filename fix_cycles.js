const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFix() {
    // 1. Check for Academic Year 2025-2026
    console.log('Checking for Academic Year 2025-2026...');
    let { data: year, error } = await supabase
        .from('academic_years')
        .select('id, name, tenant_id')
        .ilike('name', '%2025-2026%')
        .maybeSingle();

    if (error) console.error('Error fetching year:', error);

    let yearId = year?.id;

    if (!yearId) {
        console.log('Year not found. Creating...');
        // We need a tenant_id. Let's pick one from an existing program or just the first user's tenant if possible.
        // Since I can't easily get the active tenant from here without auth context, 
        // I will try to find *any* year to see the structure or just query programs to see their tenant.
        const { data: prog } = await supabase.from('analytical_programs').select('tenant_id').limit(1).maybeSingle();

        if (prog?.tenant_id) {
            const { data: newYear, error: createError } = await supabase.from('academic_years').insert({
                name: '2025-2026',
                tenant_id: prog.tenant_id,
                start_date: '2025-08-01',
                end_date: '2026-07-31'
            }).select().single();

            if (createError) {
                console.error('Error creating year:', createError);
            } else {
                console.log('Created year:', newYear);
                yearId = newYear.id;
            }
        } else {
            console.error('No existing programs or tenant found to associate new year.');
        }
    } else {
        console.log('Found year:', year);
    }

    if (yearId) {
        // 2. Update existing programs
        console.log(`Updating programs to use academic_year_id: ${yearId}`);
        const { data: updated, error: updateError } = await supabase
            .from('analytical_programs')
            .update({ academic_year_id: yearId })
            .is('academic_year_id', null)
            .select();

        if (updateError) console.error('Update error:', updateError);
        else console.log(`Updated ${updated.length} programs.`);
    }
}

checkAndFix();
