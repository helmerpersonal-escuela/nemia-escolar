import { X } from 'lucide-react';

interface PrivacyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const PrivacyModal = ({ isOpen, onClose }: PrivacyModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                        Política de Privacidad
                    </h3>
                    <button aria-label="Cerrar"
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-600 leading-relaxed space-y-4">
                    <PrivacyContent />
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
};

/** Texto completo de la Política de Privacidad; se usa en el modal y en la página pública. */
export const PrivacyContent = () => (
    <>
        <p className="font-bold text-slate-800">Última actualización: 6 de octubre de 2026</p>

        <p>
            Ko'on Soluciones (en adelante, "Ko'on", "nosotros" o "la Empresa"), con domicilio en Calle Distrito Federal No. 5-4, Colonia Josefa Garrido (Popular), Tuxtla Gutierrez; Chiapas. C.P. 29086, es el responsable del tratamiento de sus datos personales en el contexto del Servicio Vunlek, un sistema de gestión escolar proporcionado a través de una plataforma web y móvil. Esta Política de Privacidad (en adelante, la "Política") describe cómo recolectamos, usamos, compartimos y protegemos sus datos personales, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad emitidos por la autoridad competente en materia de protección de datos personales en México.
        </p>
        <p>
            Al acceder, registrarse o utilizar Vunlek (en adelante, el "Servicio"), usted consiente el tratamiento de sus datos personales conforme a esta Política. Si no está de acuerdo, no debe utilizar el Servicio. Esta Política se aplica a todos los usuarios, incluyendo administradores escolares, docentes, padres de familia, alumnos y cualquier otro individuo que interactúe con Vunlek.
        </p>
        <p>
            Ko'on se reserva el derecho de modificar esta Política en cualquier momento para adaptarse a cambios legislativos, prácticas internas o mejoras en el Servicio. Las modificaciones serán notificadas a través del Servicio, por correo electrónico a la dirección registrada en su cuenta, o mediante publicación en el sitio web de Vunlek. Es su responsabilidad revisar periódicamente esta Política. El uso continuado del Servicio después de cualquier modificación implica su aceptación de la Política revisada.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">1. Datos Personales que Recolectamos</h4>
        <p>Recolectamos datos personales necesarios para proporcionar y mejorar el Servicio. Estos incluyen:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Datos de Identificación:</strong> Nombre completo, fecha de nacimiento, género, CURP (Clave Única de Registro de Población), RFC (Registro Federal de Contribuyentes, si aplica), dirección, teléfono, correo electrónico y fotografía (para perfiles de usuarios como alumnos o docentes).</li>
            <li><strong>Datos Educativos y Académicos:</strong> Calificaciones, asistencias, progresos académicos, historial escolar, planes de estudio, evaluaciones y comentarios de docentes o padres.</li>
            <li><strong>Datos Sensibles:</strong> Información relacionada con la salud (e.g., alergias o condiciones médicas relevantes para la escuela), origen étnico o racial (si requerido por normativas educativas), y datos de menores de edad (e.g., información de alumnos menores de 18 años, que requieren consentimiento expreso de padres o tutores).</li>
            <li><strong>Datos de Suscripción y Licencia:</strong> Estado y vigencia de la suscripción o licencia, y el comprobante de compra que entregan App Store o Google Play. No recibimos ni almacenamos números de tarjeta ni datos bancarios: los cobros dentro de la aplicación los procesa la tienda.</li>
            <li><strong>Solicitudes de Presupuesto:</strong> Cuando una escuela solicita un presupuesto: nombre, cargo, correo y teléfono de quien lo solicita, y nombre, CCT, nivel, localidad y número de docentes y de alumnos de la escuela. Se usan únicamente para contactarle y preparar la propuesta.</li>
            <li><strong>Datos Obtenidos con Permisos del Dispositivo:</strong> Fotografías, documentos y notas de voz que usted decide tomar o adjuntar (cámara, micrófono y fotos); la ubicación de la escuela que usted marca en el mapa; el identificador que permite enviarle notificaciones; y el código de la credencial del alumno (QR o NFC). No accedemos a su cámara, micrófono, fotos ni ubicación en segundo plano.</li>
            <li><strong>Datos de Uso y Técnicos:</strong> Dirección IP, tipo de dispositivo, navegador, sistema operativo, cookies, identificadores únicos de dispositivo, datos de geolocalización aproximada (solo si activada por el usuario), registros de acceso, interacciones con el Servicio (e.g., clics, tiempo de sesión) y preferencias de usuario.</li>
            <li><strong>Datos de Comunicación:</strong> Mensajes, notificaciones, encuestas o feedback enviados a través de Vunlek, incluyendo comunicaciones entre escuelas, docentes y padres.</li>
        </ul>
        <p>
            No recolectamos datos personales sin su conocimiento. Para datos de menores, requerimos consentimiento verificable de padres o tutores legales, conforme a la LFPDPPP y la Ley General de los Derechos de Niños, Niñas y Adolescentes.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">2. Cómo Recolectamos los Datos</h4>
        <p>Recolectamos datos a través de:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Registro y Uso Directo:</strong> Cuando crea una cuenta, carga información (e.g., datos de alumnos), solicita un presupuesto, contrata una suscripción o interactúa con funciones del Servicio.</li>
            <li><strong>Tecnologías Automáticas:</strong> Cookies, web beacons, píxeles y similares para rastrear uso y mejorar la experiencia (ver Sección 8 para detalles).</li>
            <li><strong>Terceros:</strong> Información proporcionada por instituciones educativas, proveedores de pago (e.g., App Store de Apple, Google Play) o integraciones con herramientas externas (e.g., sistemas de la SEP, si aplica).</li>
            <li><strong>Fuentes Públicas:</strong> Datos accesibles públicamente, como perfiles educativos verificados, solo si es necesario para el Servicio.</li>
        </ul>
        <p>
            No recolectamos datos de manera encubierta ni utilizamos técnicas de profiling automatizado que afecten derechos fundamentales sin notificación.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">3. Finalidades del Tratamiento de Datos</h4>
        <p>Usamos sus datos para:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Primarias (Esenciales para el Servicio):</strong> Proporcionar funciones de gestión escolar, como registro de alumnos, generación de reportes, comunicación en tiempo real, avisos al dispositivo y administración de la suscripción o licencia. Sin estos datos, no podemos ofrecer el Servicio.</li>
            <li><strong>Secundarias (Opcionales):</strong> Mejorar el Servicio (e.g., análisis de uso para optimizaciones), enviar notificaciones promocionales sobre actualizaciones de Vunlek, realizar encuestas de satisfacción, y cumplir con obligaciones legales (e.g., reportes a autoridades educativas).</li>
            <li><strong>Otras:</strong> Prevención de fraudes, resolución de disputas, respaldo de datos y desarrollo de nuevas características.</li>
        </ul>
        <p>
            Si no consiente finalidades secundarias, puede oponerse notificando a soporte@vunlek.com, sin afectar el acceso al Servicio principal.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">4. Compartición y Transferencia de Datos</h4>
        <p>Compartimos datos solo cuando sea necesario:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Con Proveedores de Servicios:</strong> Terceros que nos asisten bajo contratos de confidencialidad y cumplimiento con la LFPDPPP: Supabase (base de datos, autenticación y almacenamiento), Vercel (alojamiento del sitio), Resend (envío de correos), Apple y Google (compras dentro de la aplicación, inicio de sesión con Google y envío de notificaciones) y los proveedores de inteligencia artificial indicados en la sección 12.</li>
            <li><strong>Con Autoridades:</strong> Para cumplir con requerimientos legales, judiciales o regulatorios (e.g., la autoridad de protección de datos personales, SEP, PROFECO).</li>
            <li><strong>En Transacciones Corporativas:</strong> En caso de fusión, adquisición o venta de activos de Ko'on, sus datos podrían transferirse al nuevo propietario.</li>
            <li><strong>Con Usuarios Autorizados:</strong> Dentro del ecosistema escolar (e.g., compartir calificaciones con padres autorizados).</li>
        </ul>
        <p>
            No vendemos ni rentamos datos personales. Transferencias internacionales (e.g., a servidores en EE.UU.) se realizan con cláusulas contractuales estándar o mecanismos equivalentes para proteger sus derechos, conforme al artículo 36 de la LFPDPPP. Puede oponerse a transferencias notificándonos.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">5. Medidas de Seguridad</h4>
        <p>
            Implementamos medidas técnicas, administrativas y físicas para proteger sus datos, incluyendo:
        </p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Encriptación de datos en tránsito (HTTPS) y en reposo.</li>
            <li>Controles de acceso restringido por rol y por escuela: cada persona ve solo la información que le corresponde.</li>
            <li>Auditorías regulares y monitoreo de brechas.</li>
            <li>Respaldos seguros y planes de recuperación de desastres.</li>
        </ul>
        <p>
            Sin embargo, ninguna medida es infalible. Ko'on no garantiza seguridad absoluta contra brechas cibernéticas, accesos no autorizados o eventos de fuerza mayor (e.g., hacks sofisticados). En caso de brecha, notificaremos a los afectados y a la autoridad competente en protección de datos personales dentro de los plazos legales (72 horas para notificación inicial), pero no seremos responsables por daños indirectos derivados de brechas causadas por terceros o negligencia del usuario (e.g., contraseñas débiles).
        </p>

        <h4 className="font-bold text-slate-800 mt-4">6. Derechos ARCO y Revocación de Consentimiento</h4>
        <p>
            Como titular de datos, tiene derechos de Acceso, Rectificación, Cancelación y Oposición (ARCO), así como limitación del uso o divulgación, y revocación de consentimiento:
        </p>
        <ul className="list-disc pl-5 space-y-1">
            <li><strong>Acceso:</strong> Solicitar información sobre sus datos tratados.</li>
            <li><strong>Rectificación:</strong> Corregir datos inexactos.</li>
            <li><strong>Cancelación:</strong> Eliminar datos cuando no sean necesarios.</li>
            <li><strong>Oposición:</strong> Rechazar tratamiento para ciertas finalidades.</li>
        </ul>
        <p>
            Para ejercer derechos, envíe una solicitud por escrito a soporte@vunlek.com, incluyendo: identificación, descripción clara del derecho, y evidencia. Responderemos en un plazo máximo de 20 días hábiles, conforme a la LFPDPPP. Si su solicitud es procedente, la implementaremos en 15 días adicionales. Puede apelar ante la autoridad competente en protección de datos personales si no está satisfecho.
            Para datos de menores, los derechos se ejercen a través de padres o tutores.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">7. Retención y Eliminación de la Cuenta y de los Datos</h4>
        <p>
            Retenemos datos mientras sea necesario para las finalidades descritas, o por los periodos que exija la ley.
        </p>
        <p id="eliminar-cuenta">
            <strong>Cómo eliminar su cuenta.</strong> Puede hacerlo usted mismo en la aplicación o el sitio web, en <em>Ajustes → Seguridad → Eliminar mi cuenta</em>, o solicitarlo a soporte@vunlek.com desde el correo de su cuenta. Las instrucciones también están en <a href="/eliminar-cuenta" className="underline font-bold">vunlek.com/eliminar-cuenta</a>.
        </p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Al eliminar la cuenta, el acceso se bloquea de inmediato.</li>
            <li>Sus datos personales de la cuenta (nombre, correo, teléfono, foto e inicio de sesión) se eliminan de forma definitiva en un plazo máximo de 30 días.</li>
            <li>Se conservan, sin su nombre como autor cuando es posible, los registros escolares que pertenecen a la institución (por ejemplo, calificaciones y asistencias que usted capturó como docente) y lo que deba conservarse por obligación legal.</li>
            <li>Los expedientes de alumnos pertenecen a la escuela: su corrección o eliminación se solicita a la dirección de la escuela, que es quien los administra. También puede escribirnos y canalizamos la solicitud.</li>
            <li>Si tiene una suscripción contratada en App Store o Google Play, cancélela desde su cuenta de la tienda; eliminar la cuenta de Vunlek no la cancela.</li>
        </ul>

        <h4 className="font-bold text-slate-800 mt-4">8. Cookies y Tecnologías Similares</h4>
        <p>
            Vunlek usa cookies, local storage y tecnologías similares para:
        </p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Autenticación y sesiones.</li>
            <li>Análisis de rendimiento (Vercel Speed Insights, con datos anonimizados y sin identificar al usuario).</li>
            <li>Personalización (e.g., recordar preferencias).</li>
        </ul>
        <p>
            Puede configurar su navegador para rechazar cookies, pero esto podría limitar funciones del Servicio. No usamos cookies para rastreo publicitario de terceros sin consentimiento.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">9. Privacidad de Menores</h4>
        <p>
            Dado que Vunlek maneja datos de menores, requerimos consentimiento expreso de padres/tutores para recolectar y tratar datos de alumnos menores de 18 años. No recolectamos datos de menores sin este consentimiento. Padres pueden revocar consentimiento en cualquier momento, lo que podría resultar en la terminación del acceso para el menor.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">10. Enlaces a Terceros</h4>
        <p>
            Vunlek puede contener enlaces a sitios de terceros (e.g., portales educativos). No controlamos sus prácticas de privacidad y no somos responsables por ellas. Revise sus políticas antes de interactuar.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">11. Inicio de Sesión con Google</h4>
        <p>
            Si decide registrarse o iniciar sesión con su cuenta de Google, recibimos de Google únicamente su <strong>nombre, dirección de correo electrónico y foto de perfil</strong> (permisos básicos "openid", "email" y "profile"). Usamos estos datos solo para crear su cuenta, identificarlo al iniciar sesión y mostrar su nombre dentro del Servicio.
        </p>
        <ul className="list-disc pl-5 space-y-1">
            <li>No accedemos a su Gmail, Google Drive, Calendar, contactos ni a ningún otro dato de su cuenta de Google.</li>
            <li>No vendemos, no compartimos con terceros para publicidad y no usamos los datos obtenidos de Google para entrenar modelos de inteligencia artificial.</li>
            <li>El uso de la información recibida de las API de Google se apega a la <a className="text-indigo-700 underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Política de datos de usuario de los servicios de API de Google</a>, incluidos los requisitos de uso limitado.</li>
            <li>Puede desvincular Vunlek en cualquier momento desde <a className="text-indigo-700 underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">myaccount.google.com/permissions</a> y solicitar la eliminación de su cuenta escribiendo a soporte@vunlek.com.</li>
        </ul>

        <h4 className="font-bold text-slate-800 mt-4">12. Uso de Inteligencia Artificial</h4>
        <p>
            Algunas funciones (planeaciones, propuestas para el Consejo Técnico Escolar, instrumentos de evaluación) envían el texto que usted captura o sube a proveedores de inteligencia artificial (Google Gemini, Groq u OpenAI) para generar sugerencias. Para las propuestas del CTE solo se envían indicadores agregados del plantel, <strong>sin nombres ni datos personales de alumnos</strong>. Los proveedores procesan la información para responder la solicitud; Vunlek no autoriza su uso para entrenar modelos. Las sugerencias de la IA deben ser revisadas por el docente antes de usarse.
        </p>

        <p>
            <strong>Sin publicidad ni rastreo.</strong> Vunlek no muestra publicidad de terceros, no vende datos personales y no rastrea a los usuarios en otras aplicaciones o sitios web.
        </p>

        <h4 className="font-bold text-slate-800 mt-4">13. Contacto y Responsable de Datos</h4>
        <p>Para preguntas, solicitudes ARCO o quejas sobre esta Política, contáctenos en:</p>
        <ul className="list-disc pl-5 space-y-1">
            <li>Email: soporte@vunlek.com</li>
            <li>Dirección: Calle Distrito Federal No. 5-4, Colonia Josefa Garrido (Popular), Tuxtla Gutierrez; Chiapas. C.P. 29086</li>
            <li>Whatsapp: +52 9617744829</li>
        </ul>

        <p className="mt-4 text-xs text-gray-500">
            El responsable de protección de datos en Ko'on es Departamento de Cumplimiento.
        </p>
    </>
)
