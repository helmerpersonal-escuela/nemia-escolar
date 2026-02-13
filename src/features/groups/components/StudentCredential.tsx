import { QRCodeSVG } from 'qrcode.react'
import { School } from 'lucide-react'

type StudentCredentialProps = {
    student: {
        first_name: string
        last_name_paternal: string
        last_name_maternal: string
        curp: string | null
        photo_url: string | null
        gender?: string
        group: {
            grade: string
            section: string
        }
    }
    school: {
        name: string
        educational_level: string
        cct: string
        logo_url?: string
    }
}

export const StudentCredential = ({ student, school }: StudentCredentialProps) => {
    const fullName = `${student.first_name} ${student.last_name_paternal} ${student.last_name_maternal || ''}`.toUpperCase()

    return (
        <div className="credential-card w-[350px] h-[220px] bg-white border border-gray-300 rounded-lg shadow-sm relative overflow-hidden flex flex-col print:border-black print:shadow-none">
            {/* Header / Background Strip */}
            <div className="h-16 bg-blue-900 w-full absolute top-0 left-0 z-0"></div>

            <div className="relative z-10 flex flex-col h-full p-4">
                {/* School Header */}
                <div className="flex items-center space-x-3 mb-2 text-white">
                    {school.logo_url ? (
                        <img src={school.logo_url} alt="Logo" className="w-10 h-10 rounded bg-white p-0.5 object-contain" />
                    ) : (
                        <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center">
                            <School className="h-6 w-6 text-white" />
                        </div>
                    )}
                    <div className="leading-tight">
                        <h1 className="text-xs font-bold uppercase tracking-wide">{school.name}</h1>
                        <p className="text-[10px] opacity-90">CCT: {school.cct}</p>
                    </div>
                </div>

                {/* Content Body */}
                <div className="flex flex-1 mt-4 space-x-4">
                    {/* Photo */}
                    <div className="flex flex-col items-center space-y-2">
                        <div className="w-24 h-24 bg-gray-200 border-2 border-white shadow-md rounded-md overflow-hidden relative">
                            {student.photo_url ? (
                                <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" />
                            ) : (
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.curp || student.first_name}&gender=${student.gender === 'MUJER' ? 'female' : 'male'}`}
                                    alt="Avatar"
                                    className="w-full h-full object-cover"
                                />
                            )}
                        </div>
                        <div className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {student.group.grade}° "{student.group.section}"
                        </div>
                    </div>

                    {/* Details & QR */}
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase">Alumno</p>
                            <h2 className="text-sm font-bold text-gray-900 leading-tight mb-2">{fullName}</h2>

                            {student.curp && (
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase">CURP</p>
                                    <p className="text-xs font-mono text-gray-800">{student.curp}</p>
                                </div>
                            )}
                        </div>

                        <div className="self-end mt-auto">
                            {student.curp ? (
                                <QRCodeSVG value={student.curp} size={50} />
                            ) : (
                                <div className="w-[50px] h-[50px] bg-gray-100 flex items-center justify-center text-[8px] text-gray-400 text-center">
                                    SIN CURP
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Stripe */}
                <div className="mt-auto pt-1 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-[8px] text-gray-400">Vigencia 2024-2025</span>
                    <span className="text-[8px] text-blue-900 font-bold">{school.educational_level}</span>
                </div>
            </div>
        </div>
    )
}
