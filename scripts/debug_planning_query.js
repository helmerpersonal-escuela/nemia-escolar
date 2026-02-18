
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function debugQuery() {
    const { error } = await supabase
        .from('lesson_plans')
        .select('id, title, temporality, start_date, campo_formativo, metodologia')
        .limit(1)

    if (error) {
        console.log('CRITICAL ERROR MESSAGE:', error.message)
        console.log('ERROR CODE:', error.code)
    } else {
        console.log('Query successful!')
    }
}

debugQuery()
