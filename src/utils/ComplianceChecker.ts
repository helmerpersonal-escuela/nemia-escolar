import { supabase } from '../lib/supabase'

export const checkAssignmentCompliance = async (studentId: string, tenantId: string, tutorId: string) => {
    try {
        // 1. Get assignments that were due yesterday
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const dateStr = yesterday.toISOString().split('T')[0]

        // Find assignments due yesterday for the tenant
        const { data: assignments, error: asmError } = await supabase
            .from('assignments')
            .select('id, title, due_date')
            .eq('tenant_id', tenantId)
            // due_date is TIMESTAMP WITH TIME ZONE, so we check if it falls within yesterday
            .gte('due_date', `${dateStr}T00:00:00Z`)
            .lte('due_date', `${dateStr}T23:59:59Z`)

        if (asmError || !assignments) return

        for (const assignment of assignments) {
            // 2. Check if we already sent a compliance alert for this
            const { data: existingAlert } = await supabase
                .from('student_alerts')
                .select('id')
                .eq('student_id', studentId)
                .eq('type', 'COMPLIANCE_REPORT')
                .eq('metadata->>assignment_id', assignment.id)
                .maybeSingle()

            if (existingAlert) continue

            // 3. Check if the student has a grade
            const { data: grade } = await supabase
                .from('grades')
                .select('is_graded, score')
                .eq('student_id', studentId)
                .eq('assignment_id', assignment.id)
                .maybeSingle()

            const fulfilled = grade && grade.is_graded

            if (!fulfilled) {
                // 4. Create the alert
                await supabase.from('student_alerts').insert({
                    tenant_id: tenantId,
                    tutor_id: tutorId,
                    student_id: studentId,
                    type: 'COMPLIANCE_REPORT',
                    title: 'Seguimiento de Entrega',
                    message: `La actividad "${assignment.title}" tenía como fecha límite ayer. El sistema no registra la entrega o calificación de este desafío.`,
                    metadata: {
                        assignment_id: assignment.id,
                        status: 'NOT_FULFILLED'
                    }
                })
            } else {
                // Optional: Notify success? 
                // "Your child fulfilled assignment X"
                await supabase.from('student_alerts').insert({
                    tenant_id: tenantId,
                    tutor_id: tutorId,
                    student_id: studentId,
                    type: 'COMPLIANCE_REPORT',
                    title: 'Misión Cumplida',
                    message: `¡Buenas noticias! Se ha registrado la entrega y calificación de la actividad "${assignment.title}".`,
                    metadata: {
                        assignment_id: assignment.id,
                        status: 'FULFILLED',
                        score: grade.score
                    }
                })
            }
        }
    } catch (error) {
        console.error('Error checking compliance:', error)
    }
}
