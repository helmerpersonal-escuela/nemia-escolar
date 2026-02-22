import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

async function updateUser() {
    console.log('Updating Daniela...')

    // Hardcoded ID from previous debug step
    const userId = '85870a47-4730-401d-a96c-a3712e821b3d'

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'INDEPENDENT_TEACHER' })
        .eq('id', userId)
        .select()

    if (error) {
        console.error('Error updating:', error)
        return
    }

    console.log('Updated user:', data)
}

updateUser()
