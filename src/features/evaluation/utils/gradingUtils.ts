export interface GradeCalculationResult {
    finalScore: number
    breakdown: {
        criteria: Record<string, number>
        activities: Record<string, number>
    }
    stats: {
        attendance: number
        absences: number
        lates: number
        excused: number
    }
}

/**
 * Calculates the final grade and breakdown for a student in a specific period
 */
export const calculateStudentPeriodGrade = (
    studentId: string,
    assignments: any[],
    grades: any[],
    criteria: any[],
    attendance: any[],
    periodId: string, // Used to filter attendance by date range if needed (passed as dates usually)
    periodDateRange?: { start: string, end: string }
): GradeCalculationResult => {

    // 1. Calculate Grade Breakdown
    const criteriaScores: Record<string, number> = {}
    const activityScores: Record<string, number> = {}

    let totalWeightedScore = 0
    let totalWeight = 0

    criteria.forEach(criterion => {
        const criterionAssignments = assignments.filter(a => a.criterion_id === criterion.id)
        if (criterionAssignments.length === 0) {
            criteriaScores[criterion.id] = 0
            return
        }

        let criterionTotalScore = 0
        let gradedCount = 0

        criterionAssignments.forEach(assignment => {
            const grade = grades.find(g => g.student_id === studentId && g.assignment_id === assignment.id)
            const score = grade?.score || 0
            activityScores[assignment.id] = score

            if (grade?.is_graded) {
                criterionTotalScore += score
                gradedCount++
            }
        })

        // Average for this criterion
        const criterionAverage = gradedCount > 0 ? criterionTotalScore / gradedCount : 0
        criteriaScores[criterion.id] = parseFloat(criterionAverage.toFixed(2))

        // Add to total weighted
        const weight = criterion.percentage || 0
        totalWeightedScore += (criterionAverage * (weight / 100))
        totalWeight += weight
    })

    // Handle Uncategorized Assignments (if any logic needed, currently ignored for final grade if no criteria)
    // or if weight < 100, might need normalization. 
    // For now assuming criteria weights sum to 100 or close.

    const finalScore = parseFloat(totalWeightedScore.toFixed(2))

    // 2. Calculate Attendance Stats within Period Range
    let relevantAttendance = attendance.filter(a => a.student_id === studentId)

    if (periodDateRange) {
        relevantAttendance = relevantAttendance.filter(a =>
            a.date >= periodDateRange.start && a.date <= periodDateRange.end
        )
    }

    const stats = {
        attendance: relevantAttendance.filter(a => a.status === 'PRESENT').length,
        absences: relevantAttendance.filter(a => a.status === 'ABSENT').length,
        lates: relevantAttendance.filter(a => a.status === 'LATE').length,
        excused: relevantAttendance.filter(a => a.status === 'EXCUSED').length
    }

    return {
        finalScore,
        breakdown: {
            criteria: criteriaScores,
            activities: activityScores
        },
        stats
    }
}

/**
 * Calculates the final academic year grade based on closed trimesters
 */
export const calculateAcademicYearGrade = (
    trimesterSnapshots: any[]
): number => {
    if (trimesterSnapshots.length === 0) return 0
    const sum = trimesterSnapshots.reduce((acc, curr) => acc + (curr.final_score || 0), 0)
    return parseFloat((sum / trimesterSnapshots.length).toFixed(2))
}
