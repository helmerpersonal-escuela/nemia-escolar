
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to bypass RLS for diagnosis

const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnose() {
    const tutorId = 'ecd127be-a39c-48a9-8661-e50ffb2248fd'

    console.log('--- Diagnosis for Tutor:', tutorId, '---')

    // 1. Check profiles
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', tutorId).single()
    console.log('Profile:', profile)

    // 2. Check guardians and students
    const { data: guardians, error: gError } = await supabase
        .from('guardians')
        .select(`
            student_id,
            student:students(
                id, 
                first_name, 
                last_name_paternal, 
                group_id,
                group:groups(id, grade, section)
            )
        `)
        .eq('user_id', tutorId)

    if (gError) console.error('Guardians error:', gError)
    console.log('Guardians/Students:', JSON.stringify(guardians, null, 2))

    // 3. Check all groups in the tenant
    if (profile?.tenant_id) {
        const { data: groups } = await supabase.from('groups').select('*').eq('tenant_id', profile.tenant_id)
        console.log('All groups in tenant:', groups)
    }

    // 4. Check incidents
    const { data: incidents } = await supabase
        .from('student_incidents')
        .select('*, student:students(first_name, last_name_paternal)')
        .eq('tenant_id', profile?.tenant_id)
    console.log('Incidents in tenant:', incidents?.length || 0)
}

diagnose()
