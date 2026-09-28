import { SettingsCard, SettingsActionButton } from './SettingsUI'
import { WizardField, wizardInput } from '../../../components/wizard/Wizard'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Lock, Smartphone, Shield, AlertCircle, Database, DownloadCloud, Trash2, CheckCircle } from 'lucide-react'
import { exportUserData } from '../../../utils/backupUtils'
import { todayISO } from '../../../lib/dates'
import { askConfirm } from '../../../components/ui/ConfirmDialog'
import { queryClient, queryPersister } from '../../../lib/queryClient'

interface SecuritySettingsProps {
    profile: any
    tenant: any
    isDirectorOrAdmin: boolean
}

export const SecuritySettings = ({ profile, tenant, isDirectorOrAdmin }: SecuritySettingsProps) => {
    const [loading, setLoading] = useState(false)
    const [mfaData, setMfaData] = useState<any>(null)
    const [verifyCode, setVerifyCode] = useState('')
    const [factors, setFactors] = useState<any[]>([])
    const [showSetup, setShowSetup] = useState(false)

    // Password State
    const [passwords, setPasswords] = useState({ new: '', confirm: '' })

    useEffect(() => {
        loadFactors()
    }, [])

    const loadFactors = async () => {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (!error) {
            setFactors(data.all || [])
        }
    }

    const handleUpdatePassword = async () => {
        if (!passwords.new || passwords.new !== passwords.confirm) {
            alert('Las contraseñas no coinciden o están vacías')
            return
        }
        setLoading(true)
        const { error } = await supabase.auth.updateUser({ password: passwords.new })
        if (!error) {
            alert('Contraseña actualizada correctamente')
            setPasswords({ new: '', confirm: '' })
        } else {
            alert(error.message)
        }
        setLoading(false)
    }

    const handleStartMfaSetup = async () => {
        setLoading(true)
        try {
            // Check if there is already an unverified factor before creating a new one
            const { data: listData, error: listError } = await supabase.auth.mfa.listFactors()
            if (listError) throw listError

            const existingUnverified = listData.all.find(f => f.status === 'unverified')

            if (existingUnverified) {
                // If there's an existing one, we use it (enroll would return 422 for Duplicate factor)
                // We need to re-enroll or challenge it. 
                // Wait, enroll doesn't challenge. Challenge happens separately.
                // If enroll returns 422, it's because it's a duplicate.
            }

            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                issuer: 'Vunlek Escolar',
                friendlyName: profile?.full_name || 'Vunlek Auth'
            })
            if (error) throw error
            setMfaData(data)
            setShowSetup(true)
        } catch (error: any) {
            console.error('MFA Enrollment Error:', error)
            alert('Error al iniciar 2FA: ' + (error.message || 'Error desconocido (422)'))
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyMfa = async () => {
        if (!mfaData || !verifyCode) return
        setLoading(true)
        try {
            const { data, error } = await supabase.auth.mfa.challengeAndVerify({
                factorId: mfaData.id,
                code: verifyCode
            })
            if (error) throw error
            alert('Autenticación de dos factores activada correctamente')
            setShowSetup(false)
            setMfaData(null)
            setVerifyCode('')
            loadFactors()
        } catch (error: any) {
            alert('Código incorrecto o error al verificar: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleUnenroll = async (factorId: string) => {
        if (!(await askConfirm('¿Estás seguro de desactivar la autenticación de dos factores? Tu cuenta será menos segura.'))) return
        setLoading(true)
        try {
            const { error } = await supabase.auth.mfa.unenroll({ factorId })
            if (error) throw error
            alert('2FA desactivado')
            loadFactors()
        } catch (error: any) {
            alert('Error al desactivar: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        if (!(await askConfirm(
            'Se cerrará tu cuenta: ya no podrás entrar y saldrás de todos tus espacios. Tus grupos, alumnos y planeaciones dejarán de estar disponibles. Si después vuelves a entrar con el mismo correo, empezarás desde cero. Te recomendamos descargar antes tu respaldo.',
            { title: '¿Eliminar tu cuenta?', confirmLabel: 'Continuar', danger: true }
        ))) return
        if (!(await askConfirm('Esta acción no se puede deshacer. ¿Eliminar tu cuenta definitivamente?', { title: 'Última confirmación', confirmLabel: 'Sí, eliminar mi cuenta', danger: true }))) return

        setLoading(true)
        try {
            const { error } = await supabase.rpc('soft_delete_account', { target_user_id: profile.id })
            if (error) throw error
            // Limpia lo guardado en este dispositivo para que no aparezca nada de la cuenta anterior
            try { queryClient.clear(); await queryPersister.removeClient() } catch { /* nada */ }
            try { Object.keys(localStorage).filter(k => k.startsWith('sb-') || k.startsWith('vunlek') || k.startsWith('settings_draft_')).forEach(k => localStorage.removeItem(k)) } catch { /* nada */ }
            await supabase.auth.signOut().catch(() => {})
            window.location.href = '/login'
        } catch (err: any) {
            alert('No se pudo eliminar la cuenta: ' + err.message)
            setLoading(false)
        }
    }

    const handleBackup = async () => {
        if (!tenant?.id) return
        if (!(await askConfirm('¿Deseas descargar una copia de seguridad?'))) return
        try {
            setLoading(true)
            await exportUserData(tenant.id, `Respaldo_Vunlek_${todayISO()}.json`)
            alert('Respaldo descargado correctamente')
        } catch (e) {
            alert('Error al generar respaldo')
        } finally {
            setLoading(false)
        }
    }

    const hasVerifiedFactor = factors.some(f => f.status === 'verified')

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <SettingsCard icon={Lock} title="Cambiar contraseña" hint="Usa al menos 8 caracteres. No la compartas con nadie.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <WizardField label="Nueva contraseña">
                        <input aria-label="Nueva contraseña" type="password" autoComplete="new-password" className={wizardInput}
                            value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} />
                    </WizardField>
                    <WizardField label="Escríbela otra vez">
                        <input aria-label="Confirmar contraseña" type="password" autoComplete="new-password" className={wizardInput}
                            value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
                    </WizardField>
                </div>
                <div className="flex justify-end">
                    <SettingsActionButton icon={Lock} onClick={handleUpdatePassword} disabled={loading || !passwords.new}>Cambiar contraseña</SettingsActionButton>
                </div>
            </SettingsCard>

            <SettingsCard icon={hasVerifiedFactor ? Shield : Smartphone} title="Verificación en dos pasos"
                hint="Además de tu contraseña, al entrar te pedirá un código de una app como Google Authenticator."
                action={hasVerifiedFactor
                    ? <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" /> Activada</span>
                    : <span className="inline-flex px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">Desactivada</span>}>
                {!hasVerifiedFactor && !showSetup && (
                    <SettingsActionButton icon={Smartphone} onClick={handleStartMfaSetup} disabled={loading}>{loading ? 'Cargando…' : 'Activar verificación'}</SettingsActionButton>
                )}
                {hasVerifiedFactor && (
                    <SettingsActionButton icon={null} tone="danger" onClick={() => handleUnenroll(factors.find(f => f.status === 'verified')?.id)} disabled={loading}>Desactivar verificación</SettingsActionButton>
                )}
                {showSetup && mfaData && (
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                        <p className="font-bold text-slate-900 mb-4">1. Escanea este código con tu app · 2. Escribe el código de 6 dígitos</p>
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                            <div className="p-3 bg-white border border-slate-200 rounded-2xl"><QRCodeSVG value={mfaData.totp.uri} size={170} /></div>
                            <div className="space-y-4 flex-1 w-full">
                                <WizardField label="Código de verificación">
                                    <input aria-label="Código de verificación" inputMode="numeric" className={`${wizardInput} text-2xl font-mono tracking-[0.3em] text-center`}
                                        value={verifyCode} onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
                                </WizardField>
                                <div className="flex flex-wrap gap-3">
                                    <SettingsActionButton icon={CheckCircle} onClick={handleVerifyMfa} disabled={verifyCode.length !== 6 || loading}>{loading ? 'Verificando…' : 'Verificar y activar'}</SettingsActionButton>
                                    <button type="button" onClick={() => { setShowSetup(false); setMfaData(null) }} className="min-h-[44px] px-4 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </SettingsCard>

            <SettingsCard icon={Database} title="Respaldo de tus datos" hint="Descarga una copia de tu información y configuración (archivo JSON)."
                action={<SettingsActionButton icon={DownloadCloud} onClick={handleBackup} disabled={loading}>Descargar respaldo</SettingsActionButton>} />

            {(isDirectorOrAdmin || profile?.role?.toUpperCase() === 'INDEPENDENT_TEACHER' || profile?.role?.toUpperCase() === 'TEACHER') && (
                <SettingsCard tone="danger" icon={AlertCircle} title="Eliminar mi cuenta"
                    hint="Cierra tu cuenta y sales de tus espacios. No se puede deshacer; descarga antes tu respaldo."
                    action={<SettingsActionButton tone="danger" icon={Trash2} onClick={handleDeleteAccount} disabled={loading}>Eliminar mi cuenta</SettingsActionButton>} />
            )}
        </div>
    )
}
