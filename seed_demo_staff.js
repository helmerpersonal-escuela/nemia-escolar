const API_URL = "https://aveqziaewxcglhteufft.supabase.co/functions/v1/create-test-user";
const TENANT_ID = "d0000000-0000-4000-a000-000000000000";
const PASSWORD = "Password123!";

// Usamos un dominio más realista para evitar bloqueos de Supabase Auth
const demoUsers = [
    { email: 'academico@escuelademonh.com', role: 'ACADEMIC_COORD', firstName: 'Laura', lastNamePaternal: 'Méndez' },
    { email: 'tecnologia@escuelademonh.com', role: 'TECH_COORD', firstName: 'Carlos', lastNamePaternal: 'Ruiz' },
    { email: 'control@escuelademonh.com', role: 'SCHOOL_CONTROL', firstName: 'Ana', lastNamePaternal: 'López' },
    { email: 'docente@escuelademonh.com', role: 'TEACHER', firstName: 'Mario', lastNamePaternal: 'Gómez' },
    { email: 'prefectura@escuelademonh.com', role: 'PREFECT', firstName: 'Pedro', lastNamePaternal: 'Ramírez' },
    { email: 'apoyo@escuelademonh.com', role: 'SUPPORT', firstName: 'Sofía', lastNamePaternal: 'Vargas' },
    { email: 'alumno@escuelademonh.com', role: 'STUDENT', firstName: 'Luisito', lastNamePaternal: 'Alumno' }
];

async function createUsers() {
    console.log("🚀 Iniciando creación de personal demo con dominio @escuelademonh.com...\n");

    for (const user of demoUsers) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...user,
                    password: PASSWORD,
                    tenantId: TENANT_ID
                })
            });

            const body = await response.text();

            if (response.ok) {
                console.log(`✅ Creado: ${user.email} (${user.role})`);
            } else if (body.includes("already registered") || body.includes("User already exists")) {
                console.log(`🟡 Saltado (Ya existe): ${user.email}`);
            } else {
                console.log(`❌ Error ${response.status} en ${user.email}:`, body);
            }
        } catch (err) {
            console.error(`🔴 Error de red para ${user.email}:`, err.message);
        }
    }

    console.log("\n✨ Proceso de seeding finalizado.");
}

createUsers();
