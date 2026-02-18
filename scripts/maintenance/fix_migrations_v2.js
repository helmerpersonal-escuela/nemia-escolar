import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');

if (!fs.existsSync(migrationsDir)) {
    console.error(`Directory not found: ${migrationsDir}`);
    process.exit(1);
}

const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

// Sort files to maintain potential dependencies
files.sort();

let counter = 1;
// Use today's date as base to ensure it's higher than old migrations
const baseDate = '20260215';

files.forEach((file) => {
    let name = file;

    const match = file.match(/^(\d+)_/);
    if (match) {
        name = file.substring(match[0].length);
    }

    // Ensure 14 digits
    let newPrefix = baseDate + String(counter).padStart(6, '0');

    const newName = `${newPrefix}_${name}`;

    if (file !== newName) {
        console.log(`Renaming: ${file} -> ${newName}`);
        fs.renameSync(path.join(migrationsDir, file), path.join(migrationsDir, newName));
    }
    counter++;
});
