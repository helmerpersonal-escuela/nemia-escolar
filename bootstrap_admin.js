
const https = require('https');

// Configuración desde tu .env
const SUPABASE_URL = "https://aveqziaewxcglhteufft.supabase.co";
const ANON_KEY = "sb_publishable_0j3xzu-npRzqahLp5M6NRg_ea1bMw1J"; // Copiado de tu .env

const userData = {
    email: "director@escuela.com",
    password: "Password123!",
    firstName: "Director",
    lastNamePaternal: "General",
    role: "DIRECTOR",
    tenantId: "00000000-0000-0000-0000-000000000000" // El Edge Function generará uno nuevo o usará este si la lógica lo permite, 
    // pero create-test-user en index.ts usa el invite system que en lazará o creará un tenant.
    // Al ser ADMIN creation, el script ignora tenantId en el body para crear nuevo?
    // Revisando index.ts: usa tenantId del body.
    // Si pasamos un tenantId inválido, fallará la FK?
    // Miremos index.ts: insert into staff_invitations...
    // Espera, staff_invitations requiere un tenant_id existente?
    // Si es el PRIMER usuario, no hay tenants.
};

// REVISIÓN CRÍTICA DE index.ts:
// const { data: invite, error: inviteError } = await supabaseAdmin.from('staff_invitations').insert({ tenant_id: tenantId ... })
// ¡ESTO FALLARÁ SI NO HAY TENANT!
// create-test-user asume que YA existe una escuela.

// ¿Cómo creamos la PRIMERA escuela?
// El flujo normal es: Sign Up -> Onboarding Wizard -> Crea Tenant.
// create-test-user está diseñado para "Staff", es decir, empleados de un tenant existente.

// Entonces, ¿cómo se registra el PRIMER director?
// A través de la página de registro pública (`/register` o `/login` -> "Sign Up").
// Pero, ¿tenemos página de Sign Up habilitada?
// En `src/features/auth/components/AuthPage.tsx` suele haber un toggle.

// Si el usuario usa el Wizard de Onboarding (`SchoolOnboardingWizard`), ese es el que crea el Tenant.
// Ese Wizard se activa cuando un usuario NO tiene `tenant_id` en su perfil.

// ENTONCES:
// 1. Necesitamos un usuario SIN tenant.
// 2. Ese usuario entra al dashboard.
// 3. El dashboard detecta "No Tenant" -> Redirige al Wizard de Escuela.
// 4. El Wizard crea el Tenant.

// PROBLEMA:
// create-test-user INTENTA insertar en `staff_invitations` que SI requiere tenant_id.
// Por lo tanto, `create-test-user` NO SIRVE para el primer usuario (Bootstrapping).

// SOLUCIÓN ALTERNATIVA:
// Usar la API de Supabase Auth directamente para crear el usuario.
// PERO no tenemos la `SERVICE_ROLE_KEY` localmente (está en Secrets de Edge Functions, pero no en el .env del usuario, solo la ANON).
// Con la ANON key, solo podemos hacer "Sign Up" normal.

// SCRIPT REVISADO:
// Hacer un Sign Up normal usando la REST API de Auth.
// Url: POST /auth/v1/signup

const data = JSON.stringify({
    email: userData.email,
    password: userData.password,
    data: {
        first_name: userData.firstName,
        last_name_paternal: userData.lastNamePaternal,
        role: "DIRECTOR" // Esto se guardará en metadata, el trigger handle_new_user lo procesará.
    }
});

const options = {
    hostname: 'aveqziaewxcglhteufft.supabase.co',
    path: '/auth/v1/signup',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': 'Bearer ' + ANON_KEY
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
        if (res.statusCode === 200) {
            console.log("\n¡ÉXITO! Usuario creado.");
            console.log("Credenciales:");
            console.log("Email: " + userData.email);
            console.log("Pass:  " + userData.password);
            console.log("\nAhora intenta iniciar sesión con estas credenciales.");
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
