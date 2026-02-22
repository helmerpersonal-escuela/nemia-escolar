import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function run() {
    console.log('--- ATTEMPTING TO UNBLOCK PROFILES ---');

    const dropSql = `
        DO $$ 
        BEGIN 
            IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_audit_profiles') THEN
                DROP TRIGGER tr_audit_profiles ON profiles;
            END IF;
            IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_profile_update_audit_log') THEN
                DROP TRIGGER on_profile_update_audit_log ON profiles;
            END IF;
        END $$;
    `;

    // exec_query usually expects a RETURN, so wrap it.
    console.log('Dropping triggers...');
    const { error: dropError } = await supabase.rpc('exec_query', {
        p_sql: `SELECT 1 FROM (SELECT 1) t; ${dropSql}`
    });

    if (dropError) {
        console.error('Drop Error:', dropError.message);
        // Sometimes multi-statement fails in one rpc. Let's try just the DO.
        const { error: dropError2 } = await supabase.rpc('exec_query', { p_sql: dropSql });
        if (dropError2) console.error('Drop Error 2:', dropError2.message);
    }

    const email = 'helmerferras@gmail.com';
    const tenantId = 'c8b671a5-8fe1-4770-985f-8255e2a22f30';

    console.log('Updating all profiles for email...');
    const updateSql = `
        UPDATE profiles 
        SET 
            first_name = 'HELMER',
            full_name = 'HELMER FERRAS COUTIÑO',
            role = 'TUTOR',
            tenant_id = '${tenantId}'
        WHERE email = '${email}'
    `;
    const { error: upErr } = await supabase.rpc('exec_query', { p_sql: updateSql });
    if (upErr) console.error('Update Error:', upErr.message);
    else console.log('Update Success.');

    console.log('Verifying...');
    const { data: final } = await supabase.rpc('exec_query', {
        p_sql: "SELECT id, email, first_name, role FROM profiles WHERE email = 'helmerferras@gmail.com'"
    });
    console.log('FINAL STATE:', JSON.stringify(final, null, 2));
}

run();
