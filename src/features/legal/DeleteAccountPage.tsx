import { useEffect } from 'react'
import { Link } from 'react-router-dom'

/** Página pública: cómo eliminar la cuenta y los datos (la piden Google Play y App Store). */
export const DeleteAccountPage = () => {
    useEffect(() => { document.title = 'Eliminar mi cuenta · Vunlek'; window.scrollTo(0, 0) }, [])
    return (
        <div className="min-h-dvh bg-slate-50">
            <header className="bg-white border-b border-slate-200">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 font-black text-slate-900"><img src="/favicon.svg" alt="" className="w-8 h-8" /> Vunlek</Link>
                    <Link to="/login" className="min-h-11 inline-flex items-center px-4 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-50">Iniciar sesión</Link>
                </div>
            </header>
            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 text-slate-700">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Eliminar mi cuenta de Vunlek</h1>
                <p>Vunlek es un servicio de Ko'on Soluciones. Puedes eliminar tu cuenta y tus datos en cualquier momento, de cualquiera de estas dos formas.</p>

                <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-3">
                    <h2 className="text-lg font-black text-slate-900">Opción 1: desde la aplicación o el sitio</h2>
                    <ol className="list-decimal pl-5 space-y-1">
                        <li>Inicia sesión en la app de Vunlek o en vunlek.com.</li>
                        <li>Abre <b>Ajustes</b> y entra a <b>Seguridad</b>.</li>
                        <li>Pulsa <b>Eliminar mi cuenta</b> y confirma.</li>
                    </ol>
                </section>

                <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-3">
                    <h2 className="text-lg font-black text-slate-900">Opción 2: por correo</h2>
                    <p>Escribe a <a className="font-bold text-indigo-700 underline" href="mailto:soporte@vunlek.com?subject=Eliminar%20mi%20cuenta%20de%20Vunlek">soporte@vunlek.com</a> desde el correo de tu cuenta, con el asunto “Eliminar mi cuenta de Vunlek”. Respondemos en un máximo de 5 días hábiles.</p>
                </section>

                <section className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-3">
                    <h2 className="text-lg font-black text-slate-900">Qué se elimina y qué se conserva</h2>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>El acceso se bloquea de inmediato.</li>
                        <li><b>Se eliminan</b> en un máximo de 30 días: tu nombre, correo, teléfono, foto, inicio de sesión, mensajes del chat y dispositivos registrados para avisos.</li>
                        <li><b>Se conservan</b> los registros escolares que pertenecen a la escuela (por ejemplo, calificaciones y asistencias capturadas por un docente), sin tu nombre como autor cuando es posible, y lo que la ley obligue a conservar.</li>
                        <li>Los expedientes de alumnos los administra cada escuela: para corregirlos o eliminarlos, solicítalo a la dirección de la escuela o escríbenos y canalizamos la solicitud.</li>
                        <li>Si contrataste una suscripción en App Store o Google Play, cancélala también desde tu cuenta de la tienda.</li>
                    </ul>
                </section>

                <p className="text-sm">Más información en la <Link to="/privacidad" className="font-bold text-indigo-700 underline">Política de Privacidad</Link> y en los <Link to="/terminos" className="font-bold text-indigo-700 underline">Términos y Condiciones</Link>.</p>
            </main>
        </div>
    )
}
