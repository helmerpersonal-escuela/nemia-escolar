import { X } from 'lucide-react';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TermsModal = ({ isOpen, onClose }: TermsModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                        Términos y Condiciones de Uso
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
                        Bienvenido a Vunlek, un sistema de gestión escolar proporcionado por Ko'on Soluciones (en adelante, "Ko'on" o "nosotros"), una empresa constituida y ubicada en México, con domicilio en Calle Distrito Federal No. 5-4, Colonia Josefa Garrido (Popular), Tuxtla Gutierrez; Chiapas. C.P. 29086. Al acceder, registrarse o utilizar Vunlek (en adelante, el "Servicio"), usted (en adelante, el "Usuario" o "usted") acepta cumplir con estos Términos y Condiciones de Uso (en adelante, los "Términos"). Si no está de acuerdo con estos Términos, no debe acceder ni utilizar el Servicio. Estos Términos constituyen un acuerdo legal vinculante entre usted y Ko'on. Ko'on se reserva el derecho de modificar estos Términos en cualquier momento, notificando los cambios a través del Servicio o por correo electrónico a la dirección proporcionada en su cuenta. Las modificaciones serán efectivas inmediatamente después de su publicación. Es su responsabilidad revisar periódicamente estos Términos. El uso continuado del Servicio después de cualquier modificación implica su aceptación de los Términos revisados. Si no acepta las modificaciones, debe cesar el uso del Servicio inmediatamente.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">1. Descripción del Servicio</h4>
                    <p>
                        Vunlek es una plataforma web y móvil de pago diseñada específicamente para la gestión escolar en instituciones educativas mexicanas. El Servicio incluye, entre otras funciones:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Registro y seguimiento de alumnos, incluyendo datos personales, calificaciones, asistencias y progresos académicos.</li>
                        <li>Gestión de horarios, planes de estudio y recursos educativos para docentes.</li>
                        <li>Comunicación en tiempo real entre escuelas, docentes, padres de familia y alumnos, mediante notificaciones, mensajes y reportes.</li>
                        <li>Herramientas administrativas como generación de reportes financieros, control de inscripciones y manejo de pagos escolares.</li>
                        <li>Integraciones con sistemas de pago en línea y herramientas educativas externas (sujetas a disponibilidad).</li>
                    </ul>
                    <p>
                        El Servicio se proporciona "tal cual" y "según disponibilidad". Ko'on no garantiza que el Servicio sea ininterrumpido, libre de errores, virus o defectos, ni que cumpla con expectativas específicas del Usuario. Ko'on puede actualizar, modificar, suspender o discontinuar cualquier parte del Servicio en cualquier momento, sin previo aviso ni responsabilidad, incluyendo por razones técnicas, de mantenimiento o regulatorias. En caso de interrupciones prolongadas (más de 48 horas), Ko'on intentará notificar a los Usuarios afectados, pero no será responsable por pérdidas derivadas de dichas interrupciones, como pérdida de datos o impactos en operaciones escolares. Vunlek no es un sustituto de sistemas educativos certificados por la Secretaría de Educación Pública (SEP) de México, y su uso no implica cumplimiento automático con normativas educativas federales o estatales. Las instituciones educativas son responsables de asegurar que el uso de Vunlek cumpla con requisitos legales aplicables.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">2. Elegibilidad y Cuentas de Usuario</h4>
                    <p>Para utilizar Vunlek, debe:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Ser mayor de 18 años o contar con el consentimiento expreso y verificable de un tutor legal si es menor de edad.</li>
                        <li>Representar a una institución educativa, ser un docente, padre de familia o alumno autorizado por la escuela.</li>
                        <li>Proporcionar información precisa, actual y completa durante el registro, incluyendo nombre, correo electrónico, rol (e.g., administrador escolar, docente, padre) y datos de la institución.</li>
                    </ul>
                    <p>Cada Usuario es responsable de:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Mantener la confidencialidad de sus credenciales de acceso (nombre de usuario, contraseña y cualquier código de autenticación de dos factores).</li>
                        <li>Notificar inmediatamente a soporte@vunlek.com en caso de sospecha de acceso no autorizado, brecha de seguridad o pérdida de credenciales.</li>
                        <li>Actualizar su información de cuenta ante cualquier cambio.</li>
                    </ul>
                    <p>
                        Ko'on no será responsable por pérdidas, daños o accesos no autorizados derivados de la negligencia del Usuario en la protección de sus credenciales. En caso de múltiples accesos desde la misma cuenta, Ko'on puede suspenderla temporalmente para investigar posibles violaciones. Las cuentas son personales e intransferibles. No se permite compartir cuentas entre Usuarios, y cualquier intento de hacerlo puede resultar en la terminación inmediata de la cuenta sin reembolso.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">3. Responsabilidades del Usuario</h4>
                    <p>Al utilizar Vunlek, usted se compromete a:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Utilizar el Servicio únicamente para fines educativos y administrativos legítimos, conforme a las leyes mexicanas.</li>
                        <li>No cargar, transmitir o compartir contenido ilegal, difamatorio, obsceno, discriminatorio, acosador, fraudulento o que infrinja derechos de terceros, incluyendo derechos de propiedad intelectual o privacidad.</li>
                        <li>Cumplir estrictamente con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP), la Ley General de Protección de Datos Personales en Posesión de Sujetos Obligados, y normativas educativas como la Ley General de Educación.</li>
                        <li>No intentar acceder, modificar o interferir con la infraestructura técnica de Vunlek, incluyendo pero no limitado a: hacking, inyección de código malicioso, denegación de servicio (DDoS), scraping de datos o sobrecarga del sistema.</li>
                        <li>Respetar la privacidad de otros Usuarios, especialmente datos sensibles de menores (e.g., calificaciones, información médica o familiar), y no divulgarlos sin consentimiento explícito.</li>
                        <li>No utilizar Vunlek para actividades comerciales no autorizadas, como venta de datos educativos o publicidad no aprobada por Ko'on.</li>
                        <li>Realizar copias de respaldo periódicas de sus datos, ya que Ko'on no garantiza la recuperación de datos perdidos por fallos técnicos o terminación de cuenta.</li>
                        <li>Notificar a Ko'on sobre cualquier error o vulnerabilidad detectada en el Servicio.</li>
                    </ul>
                    <p>
                        En caso de violación de estas responsabilidades, Ko'on se reserva el derecho de suspender o terminar la cuenta sin previo aviso, y reportar a autoridades competentes si se presume actividad ilegal. El Usuario será responsable por cualquier daño causado a Ko'on o terceros derivado de su negligencia o mal uso.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">4. Propiedad Intelectual</h4>
                    <p>
                        Todo el software, código fuente, diseños gráficos, interfaces, marcas registradas (incluyendo "Vunlek" y "Ko'on"), contenido educativo predeterminado y materiales en el Servicio son propiedad exclusiva de Ko'on o sus licenciantes. Se otorga al Usuario una licencia limitada, no exclusiva, revocable y no transferible para usar el Servicio únicamente con fines educativos y administrativos durante la vigencia de la suscripción. El Usuario no puede:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Copiar, reproducir, modificar, distribuir, vender, sublicenciar o explotar comercialmente cualquier parte de Vunlek sin consentimiento escrito de Ko'on.</li>
                        <li>Realizar ingeniería inversa, descompilar o desensamblar el software de Vunlek.</li>
                        <li>Eliminar o alterar avisos de derechos de autor o marcas en el Servicio.</li>
                    </ul>
                    <p>
                        Cualquier contenido generado por el Usuario (e.g., datos de alumnos, reportes personalizados) permanece de su propiedad, pero al cargarlo en Vunlek, otorga a Ko'on una licencia mundial, perpetua, irrevocable, no exclusiva y libre de regalías para usar, almacenar, procesar, reproducir y respaldar dicho contenido con el propósito de proporcionar y mejorar el Servicio, así como para cumplir con obligaciones legales.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">5. Pagos, Suscripciones y Reembolsos</h4>
                    <p>
                        Vunlek opera bajo un modelo de suscripción de pago (mensual, trimestral o anual), con planes adaptados a instituciones educativas (básico para escuelas pequeñas, premium para grandes instituciones). Los precios, características y opciones de pago se detallan en el sitio web de Vunlek o durante el registro.
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Pagos:</strong> Se procesan a través de proveedores externos seguros (Stripe, PayPal o bancos mexicanos). Ko'on no almacena datos de tarjetas de crédito. El Usuario autoriza cargos recurrentes automáticos según el plan seleccionado. En caso de fracaso en el pago, Ko'on puede suspender el acceso hasta la regularización, cobrando intereses moratorios al 1.5% mensual o la tasa máxima permitida por la ley mexicana.</li>
                        <li><strong>Reembolsos:</strong> Todos los pagos son no reembolsables, salvo en casos de: (i) error técnico verificado por Ko'on que impida el uso del Servicio durante más de 72 horas consecutivas; (ii) cancelación dentro de los primeros 7 días de una nueva suscripción (prueba gratuita no aplica). Reembolsos se procesan en un plazo de 30 días hábiles.</li>
                        <li><strong>Cancelaciones:</strong> El Usuario puede cancelar la suscripción en cualquier momento notificando a soporte@vunlek.com con 30 días de antelación. No se reembolsan periodos parciales. Ko'on puede ajustar precios con notificación de 60 días.</li>
                        <li><strong>Impuestos:</strong> Los precios no incluyen IVA u otros impuestos aplicables en México, que serán agregados al cargo.</li>
                    </ul>
                    <p>
                        Ko'on no será responsable por disputas con proveedores de pago, fraudes en tarjetas o fluctuaciones cambiarias en pagos internacionales.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">6. Privacidad y Protección de Datos</h4>
                    <p>
                        Ko'on procesa datos personales de acuerdo con la LFPDPPP y regulaciones mexicanas. Para detalles completos, consulte nuestra Política de Privacidad. Datos sensibles (e.g., información de menores, datos de salud educativa) se manejan con medidas de seguridad elevadas, incluyendo encriptación y acceso restringido. Sin embargo, Ko'on no garantiza seguridad absoluta contra brechas cibernéticas, robos de datos o accesos no autorizados causados por terceros. El Usuario es responsable de obtener consentimientos necesarios para cargar datos de terceros (e.g., padres autorizando datos de hijos). En caso de brecha de datos, Ko'on notificará a los afectados conforme a la ley, pero no será responsable por daños indirectos derivados de dicha brecha.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">7. Garantías y Descargos</h4>
                    <p>
                        Ko'on descarta todas las garantías expresas o implícitas, incluyendo pero no limitado a: garantías de merchantabilidad, aptitud para un propósito particular, no infracción o precisión de la información. NEMIA no garantiza compatibilidad con hardware/software del Usuario, ni que resuelva necesidades específicas educativas. Ko'on no es responsable por:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Errores en datos cargados por el Usuario (e.g., calificaciones incorrectas que afecten decisiones académicas).</li>
                        <li>Pérdidas educativas o financieras derivadas de reliance en reportes generados por Vunlek.</li>
                        <li>Interrupciones causadas por fuerza mayor (e.g., desastres naturales, ciberataques globales, fallos en proveedores de internet).</li>
                        <li>Contenido de enlaces a sitios de terceros accesibles desde Vunlek.</li>
                    </ul>

                    <h4 className="font-bold text-slate-800 mt-4">8. Limitación de Responsabilidad</h4>
                    <p>
                        En la medida máxima permitida por el Código Civil Federal y otras leyes mexicanas, Ko'on no será responsable por daños indirectos, incidentales, consecuenciales, especiales, punitivos o ejemplares, incluyendo pérdida de datos, interrupciones escolares, daños a la reputación, pérdidas económicas o lesiones personales derivadas de uso de Vunlek. La responsabilidad total de Ko'on no excederá el monto total pagado por el Usuario en los últimos 12 meses por el Servicio. Esta limitación aplica incluso si Ko'on ha sido advertido de la posibilidad de tales daños.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">9. Indemnización</h4>
                    <p>
                        El Usuario acuerda indemnizar, defender y eximir de responsabilidad a Ko'on, sus directivos, empleados y afiliados contra cualquier reclamo, demanda, pérdida, daño o gasto (incluyendo honorarios legales) derivado de: (i) violación de estos Términos; (ii) mal uso del Servicio; (iii) infracción de derechos de terceros; (iv) negligencia en el manejo de datos sensibles.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">10. Terminación</h4>
                    <p>
                        Ko'on puede terminar o suspender el acceso al Servicio en cualquier momento, con o sin causa, incluyendo violaciones a estos Términos, falta de pago o inactividad prolongada (más de 90 días). El Usuario puede terminar notificando a soporte@vunlek.com con 30 días de antelación. Al terminarse, se perderá acceso a la cuenta y datos. Ko'on proporcionará, a solicitud y costo del Usuario, una exportación de datos en formato estándar dentro de 30 días, sujeto a pago de tarifas administrativas. Datos no reclamados pueden ser eliminados permanentemente.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">11. Fuerza Mayor</h4>
                    <p>
                        Ko'on no será responsable por incumplimientos derivados de eventos de fuerza mayor, incluyendo pero no limitado a: huelgas, guerras, pandemias, fallos eléctricos, ciberataques o regulaciones gubernamentales.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">12. Ley Aplicable y Resolución de Disputas</h4>
                    <p>
                        Estos Términos se rigen por las leyes de la República Mexicana. Cualquier disputa se resolverá exclusivamente en los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero. Las partes intentarán resolver disputas amigablemente antes de litigio; si no, podrán optar por arbitraje bajo las reglas de la Cámara de Comercio de la Ciudad de México.
                    </p>

                    <h4 className="font-bold text-slate-800 mt-4">13. Disposiciones Generales</h4>
                    <ul className="list-disc pl-5 space-y-1">
                        <li><strong>Severabilidad:</strong> Si alguna disposición es inválida, las restantes permanecen vigentes.</li>
                        <li><strong>No Renuncia:</strong> La no aplicación de un derecho no implica renuncia.</li>
                        <li><strong>Asignación:</strong> Ko'on puede asignar estos Términos sin consentimiento del Usuario.</li>
                        <li><strong>Idioma:</strong> La versión en español prevalece sobre traducciones.</li>
                    </ul>

                    <h4 className="font-bold text-slate-800 mt-4">14. Contacto</h4>
                    <p>Para preguntas, soporte o notificaciones:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Email: soporte@vunlek.com</li>
                        <li>Whatsapp: +52 9617744829</li>
                        <li>Dirección: Calle Distrito Federal No. 5-4, Colonia Josefa Garrido (Popular), Tuxtla Gutierrez; Chiapas. C.P. 29086</li>
                    </ul>
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
