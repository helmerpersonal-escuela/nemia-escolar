/**
 * Claves PÚBLICAS con las que la app comprueba las licencias locales (Ed25519, 32 bytes en base64).
 * Son públicas a propósito: sirven para verificar, no para fabricar licencias.
 * Se llena con:  npm run licencias:claves
 * Puede haber más de una (por ejemplo, al cambiar de clave sin invalidar las licencias anteriores).
 */
export const LICENSE_PUBLIC_KEYS: string[] = [
    // <claves-publicas>
]
