import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { idbDelete, idbGet, idbSet } from './offline/idb'
import { isNetworkError } from './offline/network'
import { reportQueryError } from './errorReporting'

export const queryClient = new QueryClient({
    // Registro silencioso de fallas al cargar o guardar datos (errores de código;
    // los de Supabase los registra la capa de red).
    queryCache: new QueryCache({ onError: (error, query) => reportQueryError(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error, _v, _c, mutation) => reportQueryError(error, mutation.options.mutationKey, true) }),
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutos
            // Sin conexión no se reintenta (en modo offlineFirst un reintento sin red se queda
            // "en pausa" y la pantalla nunca termina de cargar): se muestra lo guardado y se
            // vuelve a consultar sola al recuperar la señal (refetchOnReconnect).
            retry: (failureCount, error) => (isNetworkError(error) ? false : failureCount < 3),
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            gcTime: 1000 * 60 * 60 * 24 * 7, // 7 días (necesario para conservar la copia offline)
            networkMode: 'offlineFirst',
        },
        mutations: {
            networkMode: 'offlineFirst',
        },
    },
})

/**
 * Copia en el dispositivo de los datos ya consultados (perfil, escuela,
 * suscripción, etc.) para que la app abra sin señal con lo último conocido.
 */
export const queryPersister = createAsyncStoragePersister({
    storage: {
        getItem: async (key: string) => (await idbGet<string>('cache', `rq:${key}`)) ?? null,
        setItem: (key: string, value: string) => idbSet('cache', `rq:${key}`, value),
        removeItem: (key: string) => idbDelete('cache', `rq:${key}`),
    },
    throttleTime: 2000,
})

export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 * 7
