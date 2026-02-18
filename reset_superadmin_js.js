
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
// MUST use Service Role Key to manage auth.users
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Supabase URL or Key not found.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const targetEmail = 'helmerpersonal@gmail.com';
const newPassword = 'password123';

async function resetSuperAdmin() {
    console.log(`Checking user: ${targetEmail}`);

    // 1. Check if user exists using Admin API
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('Error listing users:', listError);
        // Fallback: Try to sign in to see if it exists? No, admin api is better.
        // If listUsers fails, we might not have service role privileges.
    }

    const existingUser = users?.find(u => u.email === targetEmail);

    if (existingUser) {
        console.log(`User found (ID: ${existingUser.id}). Updating password...`);
        const { data, error } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: newPassword, email_confirm: true }
        );

        if (error) {
            console.error('Error updating password:', error);
        } else {
            console.log(`Password updated successfully to: ${newPassword}`);
        }
    } else {
        console.log('User not found. Creating new Super Admin user...');
        const { data, error } = await supabase.auth.admin.createUser({
            email: targetEmail,
            password: newPassword,
            email_confirm: true,
            user_metadata: {
                first_name: 'Helmer',
                last_name: 'Personal (God)',
                role: 'SUPER_ADMIN' // Metadata sync check
            }
        });

        if (error) {
            console.error('Error creating user:', error);
        } else {
            console.log(`User created successfully with password: ${newPassword}`);
            console.log('User ID:', data.user.id);
        }
    }
}

resetSuperAdmin();
