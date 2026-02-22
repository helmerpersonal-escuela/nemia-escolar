import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // REQUIERE LA SERVICE KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Faltan las variables de entorno VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function validateUser(email: string) {
    console.log(`🔍 Buscando usuario: ${email}...`)

    // 1. Obtener el ID del usuario
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers() ?? { data: { users: [] } }

    const user = users.find(u => u.email === email)

    if (!user) {
        console.error('❌ No se encontró ningún usuario con ese correo.')
        return
    }

    console.log(`✅ Usuario encontrado (ID: ${user.id}). Validando...`)

    // 2. Actualizar el estado de confirmación
    const { data, error } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
    )

    if (error) {
        console.error('❌ Error al validar:', error.message)
    } else {
        console.log(`🎉 ¡ÉXITO! El correo ${email} ha sido validado manualmente.`)
        console.log('Ahora el usuario puede iniciar sesión sin problemas.')
    }
}

// Ejecutar
const emailToValidate = 'helmerferras@gmail.com'
validateUser(emailToValidate)
