import { EvaluationReportPage } from '../../features/evaluation/pages/EvaluationReportPage'
import { StudentGradesPage } from '../../features/reports/pages/StudentGradesPage'
import { useProfile } from '../../hooks/useProfile'

export const ReportsRoute = () => {
    const { profile } = useProfile()

    if (profile?.role === 'STUDENT' || profile?.role === 'TUTOR') {
        return <StudentGradesPage />
    }
    return <EvaluationReportPage />
}

import { LatesPage } from '../../features/attendance/pages/LatesPage'
import { StudentAttendancePage } from '../../features/attendance/pages/StudentAttendancePage'

export const AttendanceRoute = () => {
    const { profile } = useProfile()

    if (profile?.role === 'STUDENT' || profile?.role === 'TUTOR') {
        return <StudentAttendancePage />
    }
    return <LatesPage />
}
