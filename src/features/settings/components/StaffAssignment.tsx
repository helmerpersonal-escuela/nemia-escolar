import { WizardField, wizardInput } from '../../../components/wizard/Wizard'

export interface Assignment { job_title: string; assigned_grades: number[]; duties: string }
export const emptyAssignment: Assignment = { job_title: '', assigned_grades: [], duties: '' }

/** Cargos sugeridos por puesto (se puede escribir otro). */
export const JOB_PRESETS: Record<string, string[]> = {
    SCHOOL_CONTROL: ['Encargado(a) de control escolar', 'Contralor(a)', 'Secretario(a)', 'Secretario(a) de dirección', 'Auxiliar administrativo(a)'],
    PREFECT: ['Prefecto(a)'],
    SUPPORT: ['Trabajo social', 'Orientación educativa', 'Psicología', 'USAER'],
    ACADEMIC_COORD: ['Coordinación académica', 'Subdirección académica'],
    TECH_COORD: ['Coordinación de actividades tecnológicas'],
    DIRECTOR: ['Director(a)', 'Subdirector(a)'],
}

/** Puestos que suelen atender grados específicos (p. ej. control escolar de primeros). */
export const ROLES_WITH_GRADES = ['SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'ACADEMIC_COORD']

export const gradesForLevel = (level?: string | null) => (String(level || '').toUpperCase() === 'PRIMARY' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3])

export const gradesLabel = (g: number[] | null | undefined) =>
    !g || g.length === 0 ? 'Todos los grados' : g.map(n => `${n}°`).join(', ')

/** Campos del encargo: cargo, grados a su cargo y actividades que asigna la dirección. */
export function StaffAssignmentFields({ role, value, onChange, level }: { role: string; value: Assignment; onChange: (a: Assignment) => void; level?: string | null }) {
    const presets = JOB_PRESETS[role] || []
    const listId = `job-presets-${role}`
    const withGrades = ROLES_WITH_GRADES.includes(role)
    const toggle = (g: number) => {
        const set = new Set(value.assigned_grades)
        set.has(g) ? set.delete(g) : set.add(g)
        onChange({ ...value, assigned_grades: [...set].sort((a, b) => a - b) })
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <WizardField label="Cargo" hint="Elige uno o escríbelo (ej. Secretaria de dirección).">
                <input aria-label="Cargo" list={presets.length ? listId : undefined} className={wizardInput} value={value.job_title}
                    placeholder={presets[0] ? `Ej. ${presets[0]}` : 'Ej. Contralor(a)'} onChange={e => onChange({ ...value, job_title: e.target.value })} />
                {presets.length > 0 && <datalist id={listId}>{presets.map(p => <option key={p} value={p} />)}</datalist>}
            </WizardField>
            {withGrades && (
                <WizardField label="Grados a su cargo" hint="Si no marcas ninguno, atiende todos los grados.">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Grados a su cargo">
                        {gradesForLevel(level).map(g => {
                            const on = value.assigned_grades.includes(g)
                            return (
                                <button key={g} type="button" aria-pressed={on} onClick={() => toggle(g)}
                                    className={`min-h-[44px] min-w-[52px] px-3 rounded-2xl border-2 text-sm font-bold ${on ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'}`}>
                                    {g}°
                                </button>
                            )
                        })}
                    </div>
                </WizardField>
            )}
            <WizardField label="Actividades asignadas" hint="Lo que la dirección le encarga. Lo verá en su inicio." className="sm:col-span-2">
                <textarea aria-label="Actividades asignadas" rows={3} className={wizardInput} value={value.duties}
                    placeholder="Ej. Inscripciones y expedientes de 1°; boletas del primer periodo; agenda de la dirección"
                    onChange={e => onChange({ ...value, duties: e.target.value })} />
            </WizardField>
        </div>
    )
}
