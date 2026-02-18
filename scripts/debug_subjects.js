const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function inspect() {
    console.log('--- Inspecting Lesson Plans ---')
    const { data: plans, error: plansError } = await supabase
        .from('lesson_plans')
        .select('id, title, group_id, subject_id')
        .limit(10)

    if (plansError) {
        console.error('Error fetching plans:', plansError)
        return
    }

    for (const plan of plans) {
        console.log(`Plan: ${plan.title} (ID: ${plan.id})`)
        console.log(`  group_id: ${plan.group_id}`)
        console.log(`  subject_id: ${plan.subject_id}`)

        // Check if subject_id is in subject_catalog
        const { data: catalogItem } = await supabase
            .from('subject_catalog')
            .select('name')
            .eq('id', plan.subject_id)
            .maybeSingle()

        if (catalogItem) {
            console.log(`  -> Found in subject_catalog: ${catalogItem.name}`)
        } else {
            // Check if subject_id is in group_subjects
            const { data: groupItem } = await supabase
                .from('group_subjects')
                .select('custom_name, subject_catalog_id')
                .eq('id', plan.subject_id)
                .maybeSingle()

            if (groupItem) {
                console.log(`  -> Found in group_subjects: ${groupItem.custom_name} (Catalog ID: ${groupItem.subject_catalog_id})`)
            } else {
                console.log(`  -> NOT FOUND in catalog or group_subjects`)
            }
        }
    }

    console.log('\n--- Inspecting Group Subjects for a Group ---')
    if (plans.length > 0) {
        const groupId = plans[0].group_id
        const { data: gs } = await supabase
            .from('group_subjects')
            .select('id, subject_catalog_id, custom_name')
            .eq('group_id', groupId)

        console.log(`Group: ${groupId}`)
        gs?.forEach(item => {
            console.log(`  GS ID: ${item.id}, Catalog ID: ${item.subject_catalog_id}, Name: ${item.custom_name}`)
        })
    }
}

inspect()
