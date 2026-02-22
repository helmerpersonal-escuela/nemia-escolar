import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
            getSession: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        },
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        })),
    },
}))
