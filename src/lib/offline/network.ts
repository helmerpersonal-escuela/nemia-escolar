/**
 * ¿El error se debe a falta de conexión (y no a un error de datos o permisos)?
 * Cubre: sin red, Wi-Fi sin internet, DNS caído, tiempo de espera.
 */
export function isNetworkError(error: unknown): boolean {
    if (!error) return false
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
    const e = error as { message?: string, name?: string, status?: number, code?: string, details?: string }
    const text = `${e.name ?? ''} ${e.message ?? ''} ${e.details ?? ''}`.toLowerCase()
    if (e.name === 'AuthRetryableFetchError') return true
    if (e.status === 0) return true
    return /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|err_internet|err_network|econnrefused|enotfound|socket hang up/.test(text)
}

/** Estado de conexión según el navegador (puede decir "en línea" con Wi-Fi sin internet). */
export function browserSaysOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}
