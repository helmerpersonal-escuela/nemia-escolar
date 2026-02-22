
import pg from 'pg';
const { Client } = pg;

const client = new Client({
    connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
    await client.connect();

    console.log('--- USER DEBUG ---');
    const userRes = await client.query(`
    select 
      u.id as user_id,
      u.email,
      p.tenant_id as profile_tenant_id,
      p.role,
      t.name as tenant_name,
      t.type as tenant_type
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.tenants t on t.id = p.tenant_id
    where u.email = 'damahel2017@gmail.com';
  `);
    console.log(userRes.rows);

    console.log('\n--- GROUPS POLICIES ---');
    const policiesRes = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'groups';
  `);
    console.log(policiesRes.rows);

    await client.end();
}

run().catch(e => console.error(e));
