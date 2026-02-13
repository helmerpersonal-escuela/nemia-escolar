import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { QRCodeSVG } from 'qrcode.react'
import { Lock, Smartphone, Shield, AlertCircle, Copy, Save, Database, DownloadCloud, Trash2, CheckCircle, RefreshCw } from 'lucide-react'
import { exportUserData } from '../../../utils/backupUtils'

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
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp'
            })
            if (error) throw error
            setMfaData(data)
            setShowSetup(true)
        } catch (error: any) {
            alert('Error al iniciar 2FA: ' + error.message)
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
        if (!confirm('¿Estás seguro de desactivar la autenticación de dos factores? Tu cuenta será menos segura.')) return
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
        if (!confirm('¿ESTÁS ABSOLUTAMENTE SEGURO? Esta acción es IRREVERSIBLE y eliminará todos tus datos.')) return
        const secondFactor = confirm('¿Confirmas que deseas ELIMINAR COMPLETAMENTE tu cuenta?')
        if (!secondFactor) return

        setLoading(true)
        try {
            const { error } = await supabase.rpc('soft_delete_account', { target_user_id: profile.id })
            if (error) throw error
            await supabase.auth.signOut()
            window.location.href = '/login'
        } catch (err: any) {
            alert('Error al eliminar cuenta: ' + err.message)
            setLoading(false)
        }
    }

    const handleBackup = async () => {
        if (!tenant?.id) return
        if (!confirm('¿Deseas descargar una copia de seguridad?')) return
        try {
            setLoading(true)
            await exportUserData(tenant.id, `Respaldo_NEMIA_${new Date().toISOString().split('T')[0]}.json`)
            alert('Respaldo descargado correctamente')
        } catch (e) {
            alert('Error al generar respaldo')
        } finally {
            setLoading(false)
        }
    }

    const hasVerifiedFactor = factors.some(f => f.status === 'verified')

    return (
        <div className="space-y-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="border-b border-gray-100 pb-6">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Seguridad y Datos</h3>
                <p className="text-sm text-gray-500 font-medium">Gestiona tu contraseña, 2FA y copias de seguridad.</p>
            </div>

            {/* 2FA Section */}
            <div className="bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100/50 relative overflow-hidden">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="bg-white p-4 rounded-2xl shadow-lg shadow-indigo-100">
                        {hasVerifiedFactor ? (
                            <Shield className="w-12 h-12 text-emerald-500" />
                        ) : (
                            <Smartphone className="w-12 h-12 text-indigo-500" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-xl font-black text-gray-900">Autenticación de Dos Factores (2FA)</h4>
                            {hasVerifiedFactor ? (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Activado
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                    Desactivado
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed max-w-xl">
                            Añade una capa extra de seguridad a tu cuenta requiriendo un código de tu aplicación de autenticación (Google Authenticator, Microsoft Authenticator) al iniciar sesión.
                        </p>

                        {!hasVerifiedFactor && !showSetup && (
                            <button
                                onClick={handleStartMfaSetup}
                                disabled={loading}
                                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                            >
                                {loading ? 'Cargando...' : 'Activar 2FA Ahora'}
                            </button>
                        )}

                        {hasVerifiedFactor && (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 bg-emerald-100/50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                                    Tu cuenta está protegida con autenticación de dos factores.
                                </div>
                                <button
                                    onClick={() => handleUnenroll(factors.find(f => f.status === 'verified')?.id)}
                                    disabled={loading}
                                    className="self-start px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all disabled:opacity-50"
                                >
                                    Desactivar 2FA
                                </button>
                            </div>
                        )}

                        {showSetup && mfaData && (
                            <div className="mt-6 bg-white p-6 rounded-3xl border border-gray-200 shadow-xl animate-in zoom-in-95 duration-200">
                                <h5 className="font-bold text-gray-900 mb-4">Escanea el código QR</h5>
                                <div className="flex flex-col md:flex-row gap-8 items-center">
                                    <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl">
                                        <QRCodeSVG value={mfaData.totp.uri} size={160} />
                                    </div>
                                    <div className="space-y-4 flex-1">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Código de Verificación</label>
                                            <input
                                                type="text"
                                                value={verifyCode}
                                                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                placeholder="000 000"
                                                className="w-full text-2xl font-mono font-bold tracking-widest px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none text-center"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleVerifyMfa}
                                                disabled={verifyCode.length !== 6 || loading}
                                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? 'Verificando...' : 'Verificar y Activar'}
                                            </button>
                                            <button
                                                onClick={() => { setShowSetup(false); setMfaData(null); }}
                                                className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 text-center">
                                            Abre tu app de autenticación y escanea el código.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Password Change */}
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5">
                        <Lock className="w-16 h-16 text-gray-900" />
                    </div>
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center">
                        <Lock className="w-4 h-4 mr-2" />
                        Cambiar Contraseña
                    </h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Nueva Contraseña</label>
                            <input
                                type="password"
                                value={passwords.new}
                                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl text-gray-900 font-bold focus:bg-white focus:border-gray-300 transition-all outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Confirmar Contraseña</label>
                            <input
                                type="password"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                className="w-full px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl text-gray-900 font-bold focus:bg-white focus:border-gray-300 transition-all outline-none"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            onClick={handleUpdatePassword}
                            disabled={loading || !passwords.new}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200 disabled:opacity-50 mt-2"
                        >
                            Actualizar Contraseña
                        </button>
                    </div>
                </div>

                {/* Backup & Delete */}
                <div className="space-y-8">
                    {/* Backup */}
                    <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-white p-2 rounded-xl shadow-sm text-emerald-600">
                                <Database className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-gray-900">Respaldo de Datos</h4>
                        </div>
                        <p className="text-xs text-gray-600 mb-6 font-medium">Descarga un archivo JSON con toda tu información.</p>
                        <button
                            onClick={handleBackup}
                            disabled={loading}
                            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <DownloadCloud className="w-4 h-4" />
                            Descargar Respaldo
                        </button>
                    </div>

                    {/* Delete Account */}
                    {isDirectorOrAdmin && (
                        <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-white p-2 rounded-xl shadow-sm text-red-600">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <h4 className="font-bold text-red-900">Eliminar Cuenta</h4>
                            </div>
                            <p className="text-xs text-red-700/80 mb-6 font-medium">Acción irreversible. Se borrarán todos tus datos permanentemente.</p>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={loading}
                                className="w-full py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar Cuenta
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
