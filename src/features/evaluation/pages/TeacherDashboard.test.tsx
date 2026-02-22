import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { TeacherDashboard } from './TeacherDashboard'

// 1. Mock External Dependencies
vi.mock('../../../hooks/useTenant', () => ({
    useTenant: vi.fn(),
}))

vi.mock('../../../hooks/useProfile', () => ({
    useProfile: vi.fn(),
}))

vi.mock('../../../hooks/useChat', () => ({
    useChat: vi.fn(() => ({ rooms: [], loading: false })),
}))

// Mock Supabase
const mockSupabaseChain = (returnData: any, returnCount: any = null) => {
    return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: returnData, error: null }),
        single: vi.fn().mockResolvedValue({ data: returnData, error: null }),
        then: (resolve: any) => resolve({ data: returnData, count: returnCount, error: null })
    }
}

vi.mock('../../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: vi.fn(),
            onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
        },
        from: vi.fn()
    }
}))

// 2. Mock Child Components
vi.mock('../components/CreateAssignmentModal', () => ({ CreateAssignmentModal: () => <div data-testid="CreateAssignmentModal" /> }))
vi.mock('../../schedule/components/DayScheduleModal', () => ({ DayScheduleModal: () => <div data-testid="DayScheduleModal" /> }))
vi.mock('../../dashboard/components/AttendanceWidget', () => ({ AttendanceWidget: () => <div data-testid="AttendanceWidget" /> }))
vi.mock('../../dashboard/components/roles/StudentSelectionModal', () => ({ StudentSelectionModal: () => <div data-testid="StudentSelectionModal" /> }))
vi.mock('../../dashboard/components/CTE/CTEAgendaModal', () => ({ CTEAgendaModal: () => <div data-testid="CTEAgendaModal" /> }))

// 3. Import Mocks
import { useTenant } from '../../../hooks/useTenant'
import { supabase } from '../../../lib/supabase'

describe('TeacherDashboard', () => {
    it('hides Agenda CTE button for Independent Teachers', async () => {
        // Setup Mocks
        (useTenant as any).mockReturnValue({
            data: { id: 'tenant-123', name: 'Escuela Demo', type: 'INDEPENDENT', role: 'INDEPENDENT_TEACHER' }
        });

        (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-123' } } });
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') return mockSupabaseChain({ id: 'user-123', role: 'INDEPENDENT_TEACHER' })
            if (table === 'groups') return mockSupabaseChain([], 0)
            return mockSupabaseChain([])
        })

        render(
            <BrowserRouter>
                <TeacherDashboard />
            </BrowserRouter>
        )

        // Wait for loading to finish (indicated by appearance of static header text)
        await waitFor(() => {
            expect(screen.getByText(/Libreta/i)).toBeInTheDocument()
        })

        const agendaButton = screen.queryByText(/Agenda CTE/i)
        expect(agendaButton).not.toBeInTheDocument()
    })

    it('shows Agenda CTE button for School Teachers', async () => {
        // Setup Mocks
        (useTenant as any).mockReturnValue({
            data: { id: 'tenant-123', name: 'Escuela Demo', type: 'SCHOOL', role: 'TEACHER' }
        });

        (supabase.auth.getUser as any).mockResolvedValue({ data: { user: { id: 'user-123' } } });
        (supabase.from as any).mockImplementation((table: string) => {
            if (table === 'profiles') return mockSupabaseChain({ id: 'user-123', role: 'TEACHER' })
            if (table === 'groups') return mockSupabaseChain([], 0)
            return mockSupabaseChain([])
        })

        render(
            <BrowserRouter>
                <TeacherDashboard />
            </BrowserRouter>
        )

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.getByText(/Libreta/i)).toBeInTheDocument()
        })

        const agendaButton = screen.getByText(/Agenda CTE/i)
        expect(agendaButton).toBeInTheDocument()
    })
})
