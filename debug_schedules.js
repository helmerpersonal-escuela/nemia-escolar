
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env manually
const envPath = path.resolve(__dirname, '.env');
const envConfig = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) acc[key.trim()] = value.trim();
    return acc;
}, {});

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log('Testing teacher_module_attendance query...');

    const { data, error } = await supabase
        .from('teacher_module_attendance')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error querying teacher_module_attendance:', error);
    } else {
        console.log('teacher_module_attendance query success:', data);
    }
}

testQuery();
