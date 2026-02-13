
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkSchema() {
    console.log('--- DIAGNOSTIC PERIOD BLIND INSERT ---')

    // Generate random UUID for testing foreign key / schema
    const fakeYearId = '00000000-0000-0000-0000-000000000000'
    console.log('Using Fake Year ID:', fakeYearId)

    const testPeriod = {
        name: 'TEST_PERIOD_SCHEMA',
        academic_year_id: fakeYearId,
        start_date: '2025-01-01',
        end_date: '2025-03-31',
        status: 'ACTIVE' // Testing if this column exists
    }

    console.log('Attempting insert with status field...')
    const { error } = await supabase.from('periods').insert(testPeriod)

    if (error) {
        console.log('INSERT RESULT:', error.message)
        if (error.message.includes('column "status" does not exist')) {
            console.log('CONCLUSION: column "status" DOES NOT EXIST.')
        } else if (error.message.includes('foreign key constraint')) {
            console.log('CONCLUSION: Schema is CORRECT (FK failed as expected).')
        } else {
            console.log('CONCLUSION: Unexpected error:', error.message)
        }
    } else {
        console.log('SUCCESS? (Unexpected for fake FK)')
    }
}

checkSchema()
