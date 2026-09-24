import { lazy, type ComponentType } from 'react'

/**
 * React.lazy para módulos con exportaciones con nombre:
 *   const GroupsPage = lazyNamed(() => import('./GroupsPage'), 'GroupsPage')
 * Si la descarga falla (p. ej. se publicó una versión nueva y el archivo viejo ya no existe),
 * recarga la página una sola vez para obtener la versión actual.
 */
export function lazyNamed<M, K extends keyof M>(loader: () => Promise<M>, name: K) {
    type C = M[K] extends ComponentType<infer P> ? ComponentType<P> : never
    return lazy(async (): Promise<{ default: C }> => {
        try {
            const mod = await loader()
            try { sessionStorage.removeItem('lazy-reload') } catch { /* sin acceso */ }
            return { default: mod[name] as C }
        } catch (error) {
            let alreadyRetried = false
            try { alreadyRetried = !!sessionStorage.getItem('lazy-reload') } catch { /* sin acceso */ }
            if (!alreadyRetried) {
                try { sessionStorage.setItem('lazy-reload', '1') } catch { /* sin acceso */ }
                window.location.reload()
            }
            throw error
        }
    })
}
