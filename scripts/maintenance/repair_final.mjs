
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

async function repair() {
    const secrets = JSON.parse(fs.readFileSync('secrets.json', 'utf8'))
    const url = secrets.VITE_SUPABASE_URL;
    const key = secrets.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
        console.log('REPAIR_LOG: ERROR_MISSING_CREDENTIALS')
        return;
    }

    const supabase = createClient(url, key)

    // Target user
    const targetEmail = 'helmerferras@gmail.com'
    console.log(`REPAIR_LOG: TARGETING_USER`)

    // Find profiles with Helmer in full_name
    const { data: profiles } = await supabase.from('profiles').select('*').ilike('full_name', '%Helmer%')

    if (!profiles || profiles.length === 0) {
        console.log('REPAIR_LOG: PROFILE_NOT_FOUND')
        return
    }

    const p = profiles[0]
    console.log(`REPAIR_LOG: FOUND_PROFILE_FOR_HELMER`)

    // Find ALL tenants and check for data
    const { data: tenants } = await supabase.from('tenants').select('*')
    const dataCheck = []

    for (const t of tenants) {
        // Checking tables where a teacher would have data
        const { count: g } = await supabase.from('groups').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)
        const { count: s } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)

        // Sometimes tables might not exist yet if migrations were skipped
        let pl = 0;
        try {
            const { count } = await supabase.from('planning_elements').select('*', { count: 'exact', head: true }).eq('tenant_id', t.id)
            pl = count || 0;
        } catch (e) { }

        const score = (g || 0) + (s || 0) + pl;
        dataCheck.push({ ...t, score })
    }

    dataCheck.sort((a, b) => b.score - a.score)

    dataCheck.forEach(t => {
        console.log(`REPAIR_LOG: TENANT_NAME_HIDDEN_SCORE_${t.score}_TYPE_${t.type}`)
    })

    const best = dataCheck[0]
    if (!best || best.score === 0) {
        console.log('REPAIR_LOG: NO_DATA_TENANT_FOUND')
        return
    }

    console.log(`REPAIR_LOG: DATA_FOUND_IN_TENANT_${best.type}`)

    // Update Profile
    const { error: upErr } = await supabase.from('profiles').update({
        tenant_id: best.id,
        role: 'TEACHER'
    }).eq('id', p.id)

    if (upErr) {
        console.log(`REPAIR_LOG: UPDATE_ERROR`)
    } else {
        console.log('REPAIR_LOG: PROFILE_UPDATED_SUCCESS')

        // Ensure tenant is INDEPENDENT (teacher context)
        await supabase.from('tenants').update({ type: 'INDEPENDENT' }).eq('id', best.id)

        // Ensure role exists in profile_roles
        await supabase.from('profile_roles').upsert({ profile_id: p.id, role: 'TEACHER' }, { onConflict: 'profile_id,role' })

        console.log('REPAIR_LOG: RECOVERY_SUCCESS')
    }
}

repair()
