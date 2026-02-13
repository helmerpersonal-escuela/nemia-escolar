import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');

if (!fs.existsSync(migrationsDir)) {
    console.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

function shieldContent(content) {
    // Regex to find CREATE POLICY statements
    // Matches: CREATE POLICY "name" ON table_name ... ;
    // Handles multi-line via [\s\S]
    const regex = /CREATE POLICY\s+"([^"]+)"\s+ON\s+([a-zA-Z0-9_."]+)([\s\S]*?);/gi;

    return content.replace(regex, (match, policyName, tableNameRaw, rest) => {
        // If already shielded (inside a DO block potentially), checking logic is hard with regex.
        // But assuming standarized format.
        // Check if the match is already inside a DO block? 
        // A simple heuristic: if the line before starts with "IF NOT EXISTS", skip?
        // Actually, if I run this on files I already modified, I might double wrap?
        // No, because I typically wrapped them in DO $$ ... END $$; 
        // The regex matches `CREATE POLICY ... ;`
        // If it's inside a DO block, it still matches.
        // I need to be careful not to double wrap.

        // Simple check: does the original content usually have 'CREATE POLICY' at the start of a line?
        // Or I can just check if the surrounding context looks like my shielding.

        // If the match is strictly `CREATE POLICY ... ;`

        // Let's refine. regex lookbehind is not fully supported in all node versions but we can check the index.

        // Better approach:
        // Identify table name handling (remove 'public.' for pg_policies check)
        const tableName = tableNameRaw.replace('public.', '').replace(/"/g, ''); // simplified

        // Construct the replacement
        const shielded = `DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = '${tableName}' AND policyname = '${policyName}'
    ) THEN
        CREATE POLICY "${policyName}" ON ${tableNameRaw}${rest};
    END IF;
END $$;`;

        return shielded;
    });
}

// Special check to avoid double wrapping
// I will read file, check if it already has "SELECT 1 FROM pg_policies ... policyname = 'X'" close to "CREATE POLICY 'X'"
// This is getting complicated for a regex replace.
// Manual fix might be safer for the 4 files I already touched, but I need to touch 20 more.

// I will re-read the already modified files and revert them? No.
// I can just Skip the files if they already contain "pg_policies".

files.forEach(file => {
    const filePath = path.join(migrationsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Safety check: if file already has "pg_policies", assume it's partially or fully shielded and SKIP or warn.
    // I already manually fixed:
    // 20260215000003_group_subjects_assignment.sql
    // 20260215000034_staff_management.sql
    // 20260215000033_multi_role_support.sql
    // 20260215000028_institutional_setup.sql

    if (content.includes('pg_policies')) {
        console.log(`Skipping ${file} (already seems shielded).`);
        return;
    }

    const matches = content.match(/CREATE POLICY/gi);
    if (!matches) {
        // No policies
        return;
    }

    console.log(`Processing ${file}... found ${matches.length} policies.`);

    const newContent = shieldContent(content);

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${file}.`);
    }
});
