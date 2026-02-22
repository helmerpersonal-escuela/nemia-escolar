import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

const sql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.admin_set_any_password(target_user_id UUID, new_password TEXT)
RETURNS JSONB AS $$
DECLARE
    is_admin boolean;
BEGIN
    SELECT public.is_god_mode() INTO is_admin;
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = target_user_id;
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

GRANT EXECUTE ON FUNCTION public.admin_set_any_password(UUID, TEXT) TO authenticated;
`;

async function run() {
    console.log('Aplicando fix de base de datos...')
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    if (error) {
        console.error('❌ Error:', error)
    } else {
        console.log('✅ Fix aplicado exitosamente.')
    }
}

run()
