const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: 'c:\\SistemaGestionEscolar\\.env' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function diagnostic() {
    const groupId = '5c444b42-4db3-43a4-bac6-5f0922ecdacc'
    const subjectId = 'c63901ba-b28d-43b8-8c02-b805db38643a'
    const periodId = '942db521-ea10-4106-bcda-028960a94be6'

    console.log(`--- Investigating Group: ${groupId} ---`)

    // 1. Check all plans for this group
    const { data: allPlans, error: plansError } = await supabase
        .from('lesson_plans')
        .select('id, title, subject_id, period_id, group_id, campo_formativo')
        .eq('group_id', groupId)

    if (plansError) {
        console.error('Error fetching plans:', plansError)
    } else {
        console.log(`Found ${allPlans.length} plans for this group:`)
        allPlans.forEach(p => {
            console.log(`- ID: ${p.id} | Title: ${p.title} | SubjectID: ${p.subject_id} | PeriodID: ${p.period_id} | Campo: ${p.campo_formativo}`)
        })
    }

    // 2. Check the specific subject in group_subjects
    const { data: subjectInfo } = await supabase
        .from('group_subjects')
        .select('id, subject_catalog_id, custom_name')
        .eq('group_id', groupId)

    console.log('\n--- Group Subjects ---')
    subjectInfo?.forEach(s => {
        console.log(`- ID: ${s.id} | CatalogID: ${s.subject_catalog_id} | Name: ${s.custom_name}`)
    })
}

diagnostic()
