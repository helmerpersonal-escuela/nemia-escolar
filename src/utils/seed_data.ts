
import { supabase } from '../lib/supabase'

const NAMES = [
    'Santiago', 'Mateo', 'Sebastián', 'Leonardo', 'Matías', 'Emiliano', 'Diego', 'Miguel Ángel', 'Daniel', 'Alexander',
    'Sofía', 'Valentina', 'Regina', 'María José', 'Ximena', 'Camila', 'Valeria', 'Victoria', 'Renata', 'Natalia',
    'Iker', 'Samuel', 'David', 'Jorge', 'Luis', 'Alberto', 'Elena', 'Lucía', 'Carmen', 'Paula',
    'Andrés', 'Felipe', 'Gabriela', 'Daniela', 'Adrián', 'Javier', 'Fernanda', 'Mariana', 'Alejandro', 'Roberto'
]

const SURNAMES = [
    'Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz',
    'Flores', 'Gómez', 'Morales', 'Vázquez', 'Jiménez', 'Reyes', 'Díaz', 'Torres', 'Gutiérrez', 'Ruiz',
    'Mendoza', 'Aguilar', 'Ortiz', 'Castillo', 'Romero', 'Álvarez', 'Méndez', 'Chávez', 'Rivera', 'Juárez'
]

// Docente de Apicultura
const SUBJECT_NAME = 'Tecnología: Apicultura'
const MODULES_PER_WEEK = 8

// 3 Grupos: 1A, 2A, 3A
const GROUPS_CONFIG = [
    { grade: 1, section: 'A', shift: 'MORNING' },
    { grade: 2, section: 'A', shift: 'MORNING' },
    { grade: 3, section: 'A', shift: 'MORNING' }
]

const CYCLE_START = new Date('2025-09-01')
const CYCLE_END = new Date('2026-07-15')

const getRandomDate = (start: Date, end: Date) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()))
}

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

const generateCURP = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array(18).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('')
}

export const seedDatabase = async (tenantId: string) => {
    console.log('Starting seed for Apicultura Teacher:', tenantId)
    const updates: string[] = []

    try {
        // 1. Clean existing data to avoid duplicates/mess
        // Delete in order of dependencies (child -> parent)
        await supabase.from('attendance').delete().eq('tenant_id', tenantId)
        await supabase.from('grades').delete().eq('tenant_id', tenantId)
        await supabase.from('assignments').delete().eq('tenant_id', tenantId)
        await supabase.from('students').delete().eq('tenant_id', tenantId)
        await supabase.from('evaluation_criteria').delete().eq('tenant_id', tenantId)
        await supabase.from('schedules').delete().eq('tenant_id', tenantId)
        await supabase.from('groups').delete().eq('tenant_id', tenantId)

        updates.push('Base de datos limpiada para este usuario.')

        const currentDate = new Date()
        const effectiveEndDate = currentDate < CYCLE_END ? currentDate : CYCLE_END

        // 1. Configure Schedule Settings (7:00 - 14:10, 50min, Break 9:30-10:00)
        const { error: settingsError } = await supabase
            .from('schedule_settings')
            .upsert({
                tenant_id: tenantId,
                start_time: '07:00',
                end_time: '14:10',
                module_duration: 50,
                breaks: [{ name: 'Receso', start_time: '09:30', end_time: '10:00' }]
            }, { onConflict: 'tenant_id' })

        if (settingsError) throw settingsError
        updates.push('Configuración de horario: 7:00 - 14:10 (Receso 9:30)')

        // 2. Ensure Subject "Tecnología: Apicultura" exists
        let subjectId: string | null = null

        const { data: existingSub } = await supabase
            .from('subject_catalog')
            .select('id')
            .eq('name', SUBJECT_NAME)
            // Removed tenant_id filter as it is a global table
            .maybeSingle()

        if (existingSub) {
            subjectId = existingSub.id
            updates.push(`Materia existente encontrada: ${SUBJECT_NAME}`)
        } else {
            // Try create, but expect RLS failure
            const { data: newSub, error: subError } = await supabase
                .from('subject_catalog')
                .insert({
                    name: SUBJECT_NAME,
                    field_of_study: 'TECHNOLOGY'
                })
                .select()
                .single()

            if (subError) {
                console.warn('Could not create subject (likely RLS), using custom_subject fallback:', subError)
                // Proceed without subjectId, will use custom_subject
            } else {
                subjectId = newSub.id
                updates.push(`Materia creada: ${SUBJECT_NAME}`)
            }
        }

        // 3. Create Groups & Distribute Schedule
        // Schedule Strategy (50 min modules, Receso 9:30-10:00)
        // 1A: 07:00 - 08:40 (Mod 1 & 2)
        // -- 08:40 - 09:30 (Mod 3 - Free)
        // -- 09:30 - 10:00 (RECESO)
        // 2A: 10:00 - 11:40 (Mod 4 & 5)
        // 3A: 11:40 - 13:20 (Mod 6 & 7)

        const SCHEDULE_SLOTS = {
            1: { start: '07:00', days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'] }, // 1A
            2: { start: '10:00', days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'] }, // 2A
            3: { start: '11:40', days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'] }  // 3A
        }

        // 1.5 Create Academic Year and Period
        let academicYearId = ''
        let periodId = ''

        // Year
        const { data: yearData } = await supabase
            .from('academic_years')
            .select('id')
            .eq('name', 'Ciclo 2025-2026')
            .eq('tenant_id', tenantId)
            .maybeSingle()

        if (yearData) {
            academicYearId = yearData.id
        } else {
            const { data: newYear, error: yearError } = await supabase
                .from('academic_years')
                .insert({
                    tenant_id: tenantId,
                    name: 'Ciclo 2025-2026',
                    start_date: CYCLE_START.toISOString().split('T')[0],
                    end_date: CYCLE_END.toISOString().split('T')[0]
                })
                .select()
                .single()

            if (yearError) {
                console.error('Error creating academic year:', yearError)
                throw yearError
            }
            academicYearId = newYear.id
            updates.push('Ciclo escolar creado: 2025-2026')
        }

        // Period (Trimestre 1)
        const { data: periodData } = await supabase
            .from('evaluation_periods')
            .select('id')
            .eq('academic_year_id', academicYearId)
            .eq('name', 'Trimestre 1')
            .maybeSingle()

        if (periodData) {
            periodId = periodData.id
        } else {
            const { data: newPeriod, error: periodError } = await supabase
                .from('evaluation_periods')
                .insert({
                    tenant_id: tenantId,
                    academic_year_id: academicYearId,
                    name: 'Trimestre 1',
                    start_date: CYCLE_START.toISOString().split('T')[0],
                    end_date: new Date(CYCLE_START.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                })
                .select()
                .single()

            if (periodError) {
                console.error('Error creating period:', periodError)
                updates.push(`ERROR CRÍTICO creando Periodo: ${periodError.message}`)
                if (periodError.details) updates.push(`Detalles: ${periodError.details}`)
                if (periodError.hint) updates.push(`Pista: ${periodError.hint}`)
            } else {
                periodId = newPeriod.id
                updates.push('Periodo creado: Trimestre 1')
            }
        }

        for (const config of GROUPS_CONFIG) {
            // A. Create Group
            const { data: group, error: groupError } = await supabase
                .from('groups')
                .insert({
                    tenant_id: tenantId,
                    grade: config.grade,
                    section: config.section,
                    academic_year_id: academicYearId,
                    shift: config.shift
                })
                .select()
                .single()

            if (groupError) {
                console.error('Error creating group:', groupError)
                updates.push(`Error creando grupo ${config.grade}°${config.section}: ${groupError.message}`)
                continue
            }
            updates.push(`Grupo ${config.grade}°${config.section} creado (ID: ${group.id.substring(0, 4)}...)`)

            // B. Register Students (25)
            const studentsData = Array(25).fill(0).map(() => ({
                tenant_id: tenantId,
                group_id: group.id,
                first_name: getRandomItem(NAMES),
                last_name_paternal: getRandomItem(SURNAMES),
                last_name_maternal: getRandomItem(SURNAMES),
                curp: generateCURP(),
                // enrollment_date: '2025-08-20', // Removed as column doesn't exist
                status: 'ACTIVE'
            }))

            const { data: students, error: studError } = await supabase.from('students').insert(studentsData).select()
            if (studError) throw studError
            updates.push(`- 25 alumnos inscritos`)

            // C. Create Schedule
            // if (subjectId) { // REMOVED Check to allow fallback
            const schedConfig = SCHEDULE_SLOTS[config.grade as 1 | 2 | 3]
            const scheduleEntries = []

            for (const day of schedConfig.days) {
                // Create 2 consecutive modules (50 mins each)
                // Module 1
                scheduleEntries.push({
                    tenant_id: tenantId,
                    group_id: group.id,
                    subject_id: subjectId, // null if created failed
                    custom_subject: subjectId ? null : SUBJECT_NAME, // Fallback
                    day_of_week: day,
                    start_time: schedConfig.start,
                    end_time: addMinutes(schedConfig.start, 50)
                })
                // Module 2
                const secondStart = addMinutes(schedConfig.start, 50)
                scheduleEntries.push({
                    tenant_id: tenantId,
                    group_id: group.id,
                    subject_id: subjectId,
                    custom_subject: subjectId ? null : SUBJECT_NAME,
                    day_of_week: day,
                    start_time: secondStart,
                    end_time: addMinutes(secondStart, 50)
                })
            }

            const { error: schedError } = await supabase.from('schedules').insert(scheduleEntries)
            if (schedError) {
                console.error('Schedule Error:', schedError)
                updates.push(`Error creando horario: ${schedError.message}`)
            } else {
                updates.push(`- Horario asignado: 8 módulos/semana (Materia: ${subjectId ? 'Oficial' : 'Personalizada'})`)
            }
            // }

            // D. Evaluation Criteria
            const criteriaData = [
                { name: 'Prácticas de Campo', percentage: 40 },
                { name: 'Bitácora', percentage: 30 },
                { name: 'Examen', percentage: 30 }
            ]

            // Only proceed if we have a period
            if (periodId) {
                const { data: criteria, error: critError } = await supabase
                    .from('evaluation_criteria')
                    .insert(criteriaData.map(c => ({
                        ...c,
                        tenant_id: tenantId,
                        group_id: group.id,
                        period_id: periodId
                    })))
                    .select()

                if (critError) {
                    console.error('Criteria Error:', critError)
                    updates.push(`Error criterios: ${critError.message}`)
                } else {
                    updates.push(`- 3 Criterios de evaluación creados`)

                    // E. Assignments & Grades & Attendance
                    if (criteria && students) {
                        // Create Assignments
                        const assignmentsData: any[] = []
                        for (const crit of criteria) {
                            for (let i = 1; i <= 3; i++) {
                                const isPast = Math.random() > 0.2
                                const dateBase = isPast ? getRandomDate(CYCLE_START, effectiveEndDate) : getRandomDate(effectiveEndDate, CYCLE_END)
                                assignmentsData.push({
                                    tenant_id: tenantId,
                                    group_id: group.id,
                                    title: `${crit.name} ${i}: Revisión de colmena`,
                                    description: 'Actividad práctica en apiario escolar',
                                    type: 'PROJECT',
                                    due_date: dateBase.toISOString().split('T')[0],
                                    criterion_id: crit.id
                                })
                            }
                        }

                        const { data: assignments, error: asmError } = await supabase.from('assignments').insert(assignmentsData).select()

                        if (asmError) {
                            updates.push(`Error tareas: ${asmError.message}`)
                        } else {
                            updates.push(`- ${assignments?.length || 0} Tareas creadas`)

                            // Create Grades
                            if (assignments) {
                                const gradesToInsert: any[] = []
                                for (const asm of assignments) {
                                    if (new Date(asm.due_date) < new Date()) {
                                        for (const st of students) {
                                            const submitted = Math.random() > 0.05 // High submission rate
                                            if (submitted) {
                                                const score = 8 + Math.random() * 2
                                                gradesToInsert.push({
                                                    tenant_id: tenantId,
                                                    assignment_id: asm.id,
                                                    student_id: st.id,
                                                    score: Math.min(10, parseFloat(score.toFixed(1))),
                                                    is_graded: true
                                                })
                                            }
                                        }
                                    }
                                }
                                // Chunk insert grades
                                const CHUNK = 100
                                for (let j = 0; j < gradesToInsert.length; j += CHUNK) {
                                    await supabase.from('grades').insert(gradesToInsert.slice(j, j + CHUNK))
                                }
                                updates.push(`- Calificaciones asignadas`)
                            }

                            // Create Attendance
                            const attendanceRecords: any[] = []
                            let loopDate = new Date(CYCLE_START)
                            while (loopDate <= effectiveEndDate) {
                                const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][loopDate.getDay()]
                                const hasClass = SCHEDULE_SLOTS[config.grade as 1 | 2 | 3].days.includes(dayName)

                                if (hasClass) {
                                    for (const student of students) {
                                        const rand = Math.random()
                                        let status = 'PRESENT'
                                        if (rand > 0.96) status = 'ABSENT'
                                        else if (rand > 0.94) status = 'LATE'

                                        attendanceRecords.push({
                                            tenant_id: tenantId,
                                            group_id: group.id,
                                            student_id: student.id,
                                            date: loopDate.toISOString().split('T')[0],
                                            status: status
                                        })
                                    }
                                }
                                loopDate.setDate(loopDate.getDate() + 1)
                            }

                            // Chunk insert attendance
                            const ATT_CHUNK = 200
                            for (let k = 0; k < attendanceRecords.length; k += ATT_CHUNK) {
                                await supabase.from('attendance').upsert(attendanceRecords.slice(k, k + ATT_CHUNK), { onConflict: 'group_id,student_id,date' })
                            }
                            updates.push(`- Asistencias generadas`)
                        }
                    }
                }
            } else {
                updates.push('AVISO: No se crearon criterios porque no se pudo crear el Periodo.')
            }
        } // End Group Config Loop

        return { success: true, log: updates }

    } catch (error: any) {
        console.error('Seed Error:', error)
        return { success: false, log: [...updates, `Error: ${error.message}`] }
    }
}

// Helper time util
function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number)
    const total = h * 60 + m + mins
    const newH = Math.floor(total / 60)
    const newM = total % 60
    return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`
}
