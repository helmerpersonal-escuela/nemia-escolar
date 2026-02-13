
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const groupId = 'd3005fa3-f3d1-4d4e-bad5-69099e5f21ba'

async function checkDuplicates() {
    console.log(`Checking students for group: ${groupId}`)
    const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name_paternal, last_name_maternal, curp')
        .eq('group_id', groupId)

    if (error) {
        console.error('Error fetching students:', error)
        return
    }

    if (!data) {
        console.log('No students found.')
        return
    }

    console.log(`Total students found: ${data.length}`)

    const seen = new Map()
    const duplicates = []

    for (const s of data) {
        const key = `${s.first_name}|${s.last_name_paternal}|${s.last_name_maternal}|${s.curp}`
        if (seen.has(key)) {
            duplicates.push({ original: seen.get(key), duplicate: s })
        } else {
            seen.set(key, s)
        }
    }

    if (duplicates.length > 0) {
        console.log('Found duplicates:')
        duplicates.forEach((d, i) => {
            console.log(`${i + 1}. ${d.original.first_name} ${d.original.last_name_paternal} (IDs: ${d.original.id}, ${d.duplicate.id})`)
        })
    } else {
        console.log('No duplicates found in database based on Name/CURP.')
    }
}

checkDuplicates()
