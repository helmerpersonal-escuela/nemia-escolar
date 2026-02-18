import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import { AlertTriangle, ArrowRight, School, Clock, Calendar } from 'lucide-react'

interface MandatorySettingsGuardProps {
    children: React.ReactNode
}

export const MandatorySettingsGuard = ({ children }: MandatorySettingsGuardProps) => {
    const { data: tenant, isLoading: loadingTenant } = useTenant()
    const [missingSettings, setMissingSettings] = useState<string[]>([])
    const [checking, setChecking] = useState(true)
    const navigate = useNavigate()
    const location = useLocation()

    // Skip check on Settings page to avoid infinite loops, but continue checking to remove banner if fixed
    const isSettingsPage = location.pathname.includes('/settings')

    useEffect(() => {
        if (!loadingTenant && tenant) {
            checkSettings()
        }
    }, [loadingTenant, tenant, location.pathname]) // Re-check on navigation

    const checkSettings = async () => {
        if (!tenant) return

        const missing = []

        // 1. Check School Details (Basic Info)
        // We consider it "missing" if name is default "Mi Escuela" AND address is empty (heuristic for new tenant)
        // Better: Check if school_details row exists? Or just rely on tenant fields which are always present.
        // Let's check specific mandatory fields in tenants or school_details
        if (!tenant.address || !tenant.educationalLevel || tenant.name === 'Mi Escuela') {
            missing.push('school')
        }

        // 2. Check Schedule Settings
        const { data: schedule } = await supabase
            .from('schedule_settings')
            .select('id')
            .eq('tenant_id', tenant.id)
            .maybeSingle()

        if (!schedule) {
            missing.push('schedule')
        }

        // 3. Check Active Academic Year
        const { data: activeYear } = await supabase
            .from('academic_years')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('is_active', true)
            .maybeSingle()

        if (!activeYear) {
            missing.push('year')
        }

        setMissingSettings(missing)
        setChecking(false)

        // Redirect Logic:
        // Only redirect if NOT already on settings page AND we have missing critical settings
        // AND validation is done.
        if (missing.length > 0 && !isSettingsPage) {
            navigate('/settings?tab=institucional', { replace: true })
        }
    }

    if (loadingTenant || checking) {
        // Optional: Loading spinner, or just render children (might cause flicker if redirect happens)
        // Rendering nothing is safer to prevent flashing protected content
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    // If we are on Settings Page, we might want to show a BANNER if things are missing
    if (isSettingsPage && missingSettings.length > 0) {
        return (
            <div className="relative">
                {/* Persistent Banner for Settings Page */}
                <div className="bg-red-500 text-white px-6 py-3 shadow-lg mb-6 rounded-2xl mx-6 mt-6 flex items-center justify-between animate-in slide-in-from-top-2">
                    <div className="flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-3 animate-bounce" />
                        <div>
                            <p className="font-black text-sm uppercase tracking-wide">Configuración Obligatoria Pendiente</p>
                            <p className="text-xs opacity-90 font-medium">
                                Debes completar:
                                {missingSettings.includes('school') && ' Datos de Escuela,'}
                                {missingSettings.includes('schedule') && ' Horarios,'}
                                {missingSettings.includes('year') && ' Ciclo Escolar Activo'}
                            </p>
                        </div>
                    </div>
                </div>
                {children}
            </div>
        )
    }

    // If we have missing settings and are NOT on settings page, we should have redirected already.
    // But as a fallback/guard:
    if (missingSettings.length > 0) {
        return null // Should have redirected
    }

    return <>{children}</>
}
