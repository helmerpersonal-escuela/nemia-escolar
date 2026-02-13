
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Try to load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugSchedule() {
    const { data: { user } } = await supabase.auth.getUser()
    // We might not have a signed-in user in this context if we just run node, 
    // but the previous code didn't use user ID for the schedule query, just tenant_id.
    // However, we need a tenant_id. Let's fetch the first tenant found.

    const { data: tenants } = await supabase.from('tenants').select('id').limit(1)
    if (!tenants || tenants.length === 0) {
        console.log('No tenants found')
        return
    }
    const tenantId = tenants[0].id
    console.log('Tenant ID:', tenantId)

    const day = 'TUESDAY' // User's metadata says it's Tuesday
    console.log('Checking schedule for:', day)

    const { data: schedules, error } = await supabase
        .from('schedules')
        .select(`
            id,
            start_time,
            end_time,
            group:groups(grade, section),
            subject:subject_catalog(name),
            custom_subject
        `)
        .eq('tenant_id', tenantId)
        .eq('day_of_week', day)
        .order('start_time')

    if (error) {
        console.error('Error fetching schedules:', error)
        return
    }

    console.log('Found schedules:', JSON.stringify(schedules, null, 2))

    // Check current time
    const now = new Date()
    const currentTimeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
    console.log('Current System Time String (Node):', currentTimeStr)
}

debugSchedule()
