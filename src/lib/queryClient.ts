
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes default
            retry: 3, // Retry more times for connection issues
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            gcTime: 1000 * 60 * 60 * 24, // Keep in memory for 24h
        },
    },
})
