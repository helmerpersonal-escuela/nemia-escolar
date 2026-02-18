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
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 text-sm text-slate-600 leading-relaxed space-y-4">
                    <p className="font-bold text-slate-800">Última actualización: 13 de febrero de 2026</p>

                    <p>
                        Ko'on Soluciones (en adelante, "Ko'on", "nosotros" o "la Empresa"), con domicilio en Calle Distrito Federal No. 5-4, Colonia Josefa Garrido (Popular), Tuxtla Gutierrez; Chiapas. C.P. 29086, es el responsable del tratamiento de sus datos personales en el contexto del Servicio Vunlek, un sistema de gestión escolar proporcionado a través de una plataforma web y móvil. Esta Política de Privacidad (en adelante, la "Política") describe cómo recolectamos, usamos, compartimos y protegemos sus datos personales, de conformidad con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), su Reglamento y los Lineamientos del Aviso de Privacidad emitidos por el Instituto Nacional de Transparencia, Acceso a la Información y Protección de Datos Personales (INAI) en México.
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
                        <li><strong>Datos Financieros:</strong> Información de pagos, como números de tarjeta (procesados por terceros), historial de transacciones escolares (e.g., colegiaturas, inscripciones) y datos bancarios para reembolsos.</li>
                        <li><strong>Datos de Uso y Técnicos:</strong> Dirección IP, tipo de dispositivo, navegador, sistema operativo, cookies, identificadores únicos de dispositivo, datos de geolocalización aproximada (solo si activada por el usuario), registros de acceso, interacciones con el Servicio (e.g., clics, tiempo de sesión) y preferencias de usuario.</li>
                        <li><strong>Datos de Comunicación:</strong> Mensajes, notificaciones, encuestas o feedback enviados a través de Vunlek, incluyendo comunicaciones entre escuelas, docentes y padres.</li>
                    </ul>
                    <p>
                        No recolectamos datos personales sin su conocimiento. Para datos de menores, requerimos consentimiento verificable de padres o tutores legales, conforme a la LFPDPPP y la Ley General de los Derechos de Niños, Niñas y Adolescentes.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">2. Cómo Recolectamos los Datos</h4>
                    <p>Recolectamos datos a través de:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Registro y Uso Directo:</strong> Cuando crea una cuenta, carga información (e.g., datos de alumnos), realiza pagos o interactúa con funciones del Servicio.</li>
                        <li><strong>Tecnologías Automáticas:</strong> Cookies, web beacons, píxeles y similares para rastrear uso y mejorar la experiencia (ver Sección 8 para detalles).</li>
                        <li><strong>Terceros:</strong> Información proporcionada por instituciones educativas, proveedores de pago (e.g., Stripe, bancos mexicanos) o integraciones con herramientas externas (e.g., sistemas de la SEP, si aplica).</li>
                        <li><strong>Fuentes Públicas:</strong> Datos accesibles públicamente, como perfiles educativos verificados, solo si es necesario para el Servicio.</li>
                    </ul>
                    <p>
                        No recolectamos datos de manera encubierta ni utilizamos técnicas de profiling automatizado que afecten derechos fundamentales sin notificación.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">3. Finalidades del Tratamiento de Datos</h4>
                    <p>Usamos sus datos para:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Primarias (Esenciales para el Servicio):</strong> Proporcionar funciones de gestión escolar, como registro de alumnos, generación de reportes, comunicación en tiempo real y procesamiento de pagos. Sin estos datos, no podemos ofrecer el Servicio.</li>
                        <li><strong>Secundarias (Opcionales):</strong> Mejorar el Servicio (e.g., análisis de uso para optimizaciones), enviar notificaciones promocionales sobre actualizaciones de Vunlek, realizar encuestas de satisfacción, y cumplir con obligaciones legales (e.g., reportes a autoridades educativas).</li>
                        <li><strong>Otras:</strong> Prevención de fraudes, resolución de disputas, respaldo de datos y desarrollo de nuevas características.</li>
                    </ul>
                    <p>
                        Si no consiente finalidades secundarias, puede oponerse notificando a soporte@vunlek.com, sin afectar el acceso al Servicio principal.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">4. Compartición y Transferencia de Datos</h4>
                    <p>Compartimos datos solo cuando sea necesario:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Con Proveedores de Servicios:</strong> Terceros que nos asisten (e.g., hosting en la nube como AWS o Google Cloud, procesadores de pagos, auditores), bajo contratos que garantizan confidencialidad y cumplimiento con la LFPDPPP.</li>
                        <li><strong>Con Autoridades:</strong> Para cumplir con requerimientos legales, judiciales o regulatorios (e.g., INAI, SEP, PROFECO).</li>
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
                        <li>Controles de acceso restringido (e.g., autenticación de dos factores).</li>
                        <li>Auditorías regulares y monitoreo de brechas.</li>
                        <li>Respaldos seguros y planes de recuperación de desastres.</li>
                    </ul>
                    <p>
                        Sin embargo, ninguna medida es infalible. Ko'on no garantiza seguridad absoluta contra brechas cibernéticas, accesos no autorizados o eventos de fuerza mayor (e.g., hacks sofisticados). En caso de brecha, notificaremos a los afectados y al INAI dentro de los plazos legales (72 horas para notificación inicial), pero no seremos responsables por daños indirectos derivados de brechas causadas por terceros o negligencia del usuario (e.g., contraseñas débiles).
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
                        Para ejercer derechos, envíe una solicitud por escrito a soporte@vunlek.com, incluyendo: identificación, descripción clara del derecho, y evidencia. Responderemos en un plazo máximo de 20 días hábiles, conforme a la LFPDPPP. Si su solicitud es procedente, la implementaremos en 15 días adicionales. Puede apelar ante el INAI si no está satisfecho.
                        Para datos de menores, los derechos se ejercen a través de padres o tutores.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">7. Retención de Datos</h4>
                    <p>
                        Retenemos datos mientras sea necesario para las finalidades descritas, o por periodos legales (e.g., 5 años para datos fiscales conforme al Código Fiscal de la Federación). Al terminar su cuenta o revocar consentimiento, eliminaremos o anonimizaremos datos, salvo obligaciones legales. Puede solicitar eliminación anticipada, sujeto a revisión.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">8. Cookies y Tecnologías Similares</h4>
                    <p>
                        Vunlek usa cookies, local storage y tecnologías similares para:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Autenticación y sesiones.</li>
                        <li>Análisis de uso (e.g., Google Analytics, con datos anonimizados).</li>
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

                    <h4 className="font-bold text-slate-800 mt-4">11. Contacto y Responsable de Datos</h4>
                    <p>Para preguntas, solicitudes ARCO o quejas sobre esta Política, contáctenos en:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Email: soporte@vunlek.com</li>
                        <li>Dirección: Calle Distrito Federal No. 5-4, Colonia Josefa Garrido (Popular), Tuxtla Gutierrez; Chiapas. C.P. 29086</li>
                        <li>Whatsapp: +52 9617744829</li>
                    </ul>

                    <p className="mt-4 text-xs text-gray-400">
                        El responsable de protección de datos en Ko'on es Departamento de Cumplimiento.
                    </p>
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
