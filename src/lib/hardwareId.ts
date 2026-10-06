/**
 * Identificador de este equipo (HWID) para las licencias locales.
 *  - App de escritorio: se calcula a partir del identificador de la computadora (no cambia
 *    al reinstalar la app). Empieza con "PC-".
 *  - Navegador o app móvil: no hay acceso al hardware; se usa un identificador de la
 *    instalación, que cambia si se borran los datos de la app. Empieza con "NAV-".
 */
const INSTALL_KEY = 'vunlek_install_id'
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789' // sin letras que se confunden (I, L, O, U, 0, 1)

const group = (bytes: Uint8Array) => {
    let s = ''
    for (const b of bytes) s += ALPHABET[b % ALPHABET.length]
    return s.match(/.{1,5}/g)!.join('-')
}

function installId(): string {
    try {
        const saved = localStorage.getItem(INSTALL_KEY)
        if (saved) return saved
        const id = `NAV-${group(crypto.getRandomValues(new Uint8Array(20)))}`
        localStorage.setItem(INSTALL_KEY, id)
        return id
    } catch {
        return 'NAV-SIN-ALMACENAMIENTO'
    }
}

export interface HardwareId { id: string; kind: 'PC' | 'NAV' }

export async function getHardwareId(): Promise<HardwareId> {
    const desktop = (window as any).vunlekDesktop
    if (desktop?.getHardwareId) {
        try {
            const id = await desktop.getHardwareId()
            if (typeof id === 'string' && id.startsWith('PC-')) return { id, kind: 'PC' }
        } catch { /* se usa el de la instalación */ }
    }
    return { id: installId(), kind: 'NAV' }
}
