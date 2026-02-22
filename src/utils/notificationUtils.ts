import { supabase } from '../lib/supabase'

export const createAssignmentAlerts = async (assignment: {
    id: string
    tenant_id: string
    group_id: string
    title: string
    due_date: string
}) => {
    try {
        // 1. Get all students in the group
        const { data: students, error: studentError } = await supabase
            .from('students')
            .select('id, first_name')
            .eq('group_id', assignment.group_id)

        if (studentError || !students) throw studentError

        // 2. For each student, find their guardians (tutors)
        for (const student of students) {
            const { data: guardians, error: guardError } = await supabase
                .from('guardians')
                .select('user_id')
                .eq('student_id', student.id)

            if (guardError || !guardians) continue

            // 3. Create an alert for each guardian
            for (const guardian of guardians) {
                await supabase.from('student_alerts').insert({
                    tenant_id: assignment.tenant_id,
                    tutor_id: guardian.user_id,
                    student_id: student.id,
                    type: 'ASSIGNMENT_CREATED',
                    title: 'Nueva Actividad Asignada',
                    message: `Se ha asignado la tarea "${assignment.title}" para ${student.first_name}. Fecha de entrega: ${new Date(assignment.due_date).toLocaleDateString()}.`,
                    metadata: {
                        assignment_id: assignment.id,
                        due_date: assignment.due_date
                    }
                })
            }
        }
    } catch (error) {
        console.error('Error creating assignment alerts:', error)
    }
}
