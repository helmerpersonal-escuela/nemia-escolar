import { describe, expect, it } from 'vitest'
import { authMessage } from '../lib/authMessages'

describe('mensajes de inicio de sesión y registro', () => {
    it('traduce los errores del servicio de cuentas', () => {
        expect(authMessage(new Error('Invalid login credentials'))).toMatch(/correo o la contraseña/)
        expect(authMessage({ message: 'Email not confirmed' })).toMatch(/confirmas tu correo/)
        expect(authMessage({ message: 'Database error saving new user' })).toMatch(/reenvíen la invitación/)
        expect(authMessage({ message: 'User already registered' })).toMatch(/ya tiene una cuenta/)
    })
    it('respeta los mensajes propios y usa el genérico si no hay ninguno', () => {
        expect(authMessage({ message: 'Esta invitación es para otro correo' })).toBe('Esta invitación es para otro correo')
        expect(authMessage(null, 'Intenta de nuevo')).toBe('Intenta de nuevo')
    })
})
