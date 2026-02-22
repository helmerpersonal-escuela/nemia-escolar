import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function checkUser() {
    console.log('Searching for Daniela...')
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', '%Daniela%')

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('Found users:', data)

    if (data && data.length > 0) {
        const user = data[0]
        console.log('ROLEJS:', user.role)
        console.log('TYPEJS:', user.tenant_id ? 'HAS_TENANT' : 'NO_TENANT')

        if (user.tenant_id) {
            const { data: t } = await supabase.from('tenants').select('type').eq('id', user.tenant_id).single()
            console.log('TENANT_TYPE:', t?.type)
        }

        const { data: pt, error: ptError } = await supabase
            .from('profile_tenants')
            .select('role, tenant_id, tenants(name, type)')
            .eq('profile_id', user.id)

        if (ptError) console.error('Error fetching profile_tenants:', ptError)
        else console.log('PROFILE_TENANTS:', JSON.stringify(pt))
    }
}

checkUser()
