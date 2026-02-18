const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function checkSchema() {
    console.log('--- Checking lesson_plans columns ---')
    const { data, error } = await supabase
        .from('lesson_plans')
        .select('*')
        .limit(1)

    if (error) {
        console.error('Error:', error)
        return
    }

    if (data.length > 0) {
        console.log('Columns found in a record:')
        const columns = Object.keys(data[0])
        console.log(columns)
        console.log('Has project_duration:', columns.includes('project_duration'))
        console.log('Has purpose:', columns.includes('purpose'))
    } else {
        console.log('No records found to inspect columns.')
    }
}

checkSchema()
