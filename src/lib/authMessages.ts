/** Mensajes del servicio de cuentas, en español y diciendo qué hacer. */
const MAP: [RegExp, string][] = [
    [/invalid login credentials/i, 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.'],
    [/email not confirmed/i, 'Aún no confirmas tu correo. Abre el mensaje que te enviamos (revisa también Spam) y toca el enlace; después vuelve a entrar.'],
    [/user already registered|already been registered/i, 'Ese correo ya tiene una cuenta. Inicia sesión o usa "¿Olvidaste tu contraseña?".'],
    [/database error saving new user/i, 'No pudimos crear la cuenta. Si te invitó una escuela, pide que te reenvíen la invitación y abre el enlace nuevo.'],
    [/la invitación no es válida/i, 'La invitación ya se usó, venció o es para otro correo. Pide a la escuela que te envíe una nueva.'],
    [/password should be at least|weak password/i, 'La contraseña es muy corta o muy fácil. Usa al menos 8 caracteres con letras y números.'],
    [/rate limit|too many requests|security purposes/i, 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.'],
    [/failed to fetch|network|load failed/i, 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'],
    [/signups? not allowed|signup is disabled/i, 'El registro está cerrado por ahora.'],
    [/jwt expired|session.*expired|refresh token/i, 'Tu sesión venció. Vuelve a iniciar sesión.'],
]

export function authMessage(err: unknown, fallback = 'No se pudo completar. Intenta de nuevo.'): string {
    const raw = String((err as any)?.message ?? err ?? '')
    for (const [re, msg] of MAP) if (re.test(raw)) return msg
    // Los mensajes propios de VUNLEK ya vienen en español
    return raw || fallback
}
