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

files.forEach((file) => {
    let prefix = '';
    let name = file;

    const match = file.match(/^(\d+)_/);
    if (match) {
        prefix = match[1];
        name = file.substring(match[0].length);
    }

    // Supabase CLI expects 14 digits (YYYYMMDDHHMMSS)
    // We will generate a unique 14-digit prefix based on the order
    // Using 20240101 + 6 digits of counter to ensure uniqueness and order
    let newPrefix = '20240101' + String(counter).padStart(6, '0');

    // Special case: if it already has 14 digits, we might want to keep it?
    // But the problem is collisions in the 8-digit ones.
    // To be safe and clean, let's re-prefix everything sequentially based on sort.

    const newName = `${newPrefix}_${name}`;

    if (file !== newName) {
        console.log(`Renaming: ${file} -> ${newName}`);
        fs.renameSync(path.join(migrationsDir, file), path.join(migrationsDir, newName));
    }
    counter++;
});
