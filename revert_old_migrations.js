import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const listPath = path.join(__dirname, 'migration_list_final.txt');

if (!fs.existsSync(listPath)) {
    console.error(`Migration list file not found: ${listPath}`);
    process.exit(1);
}

const content = fs.readFileSync(listPath, 'utf8');

const lines = content.split('\n');
const versionsToRevert = [];

lines.forEach(line => {
    // Skip headers and separators
    if (line.includes('Local') || line.includes('---') || !line.trim()) return;

    // Split by pipe
    const parts = line.split('|').map(p => p.trim());

    // Expected format: [Local, Remote, Time]
    // If we have at least 2 parts
    if (parts.length >= 2) {
        // Sanitize: Only keep digits.
        const remoteVersion = parts[1].replace(/\D/g, '');
        // If there is a remote version, add it to the list
        if (remoteVersion && remoteVersion.length > 0) {
            versionsToRevert.push(remoteVersion);
        }
    }
});

console.log('Found remote versions:', versionsToRevert.length);
console.log('Versions to REVERT:', versionsToRevert);

if (versionsToRevert.length === 0) {
    console.log('No remote versions found to revert.');
} else {
    versionsToRevert.forEach(version => {
        console.log(`Reverting ${version}...`);
        try {
            execSync(`npx supabase migration repair --status reverted ${version}`, { stdio: 'inherit' });
        } catch (e) {
            console.error(`Failed to revert ${version}:`, e.message);
        }
    });
}
