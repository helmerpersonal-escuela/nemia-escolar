import { Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { LoginPage } from './features/auth/pages/LoginPage'
import { RegisterPage } from './features/auth/pages/RegisterPage'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { DashboardPage } from './features/dashboard/pages/DashboardPage'
import { GroupsPage } from './features/groups/pages/GroupsPage'
import { GroupDetailsPage } from './features/groups/pages/GroupDetailsPage'
import { OnboardingWizard } from './features/onboarding/components/OnboardingWizard'
import { SettingsPage } from './features/settings/pages/SettingsPage'
import { SchedulePage } from './features/schedule/pages/SchedulePage'
import { AgendaPage } from './features/agenda/pages/AgendaPage'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Loader2 } from 'lucide-react'

import { TeacherDashboard } from './features/evaluation/pages/TeacherDashboard'
import { EvaluationSetupPage } from './features/evaluation/pages/EvaluationSetupPage'
import { RubricListPage } from './features/rubrics/pages/RubricListPage'
import { RubricEditorPage } from './features/rubrics/pages/RubricEditorPage'
import { InstrumentBuilderPage } from './features/rubrics/pages/InstrumentBuilderPage'
import { FormativeToolsPage } from './features/evaluation/pages/FormativeToolsPage'
import { StudentPortfolioPage } from './features/evaluation/pages/StudentPortfolioPage'
import { GradebookPage } from './features/evaluation/pages/GradebookPage'
import { PlanningListPage } from './features/planning/pages/PlanningListPage'
import { PlanningEditorPage } from './features/planning/pages/PlanningEditorPage'
import { StudentTrackingPage } from './features/students/pages/StudentTrackingPage'
import { StudentReportPage } from './features/reports/pages/StudentReportPage'
import { AnalyticalProgramListPage } from './features/analytical-program/pages/AnalyticalProgramListPage'
import { AnalyticalProgramEditorPage } from './features/analytical-program/pages/AnalyticalProgramEditorPage'
import { EvaluationReportPage } from './features/evaluation/pages/EvaluationReportPage'
import { ChatModule } from './features/communications/ChatModule'
import { StaffAttendancePortal } from './features/attendance/pages/StaffAttendancePortal'
import { SubstitutionDashboard } from './features/attendance/pages/SubstitutionDashboard'
import { CitationsPage } from './features/attendance/pages/CitationsPage'
import { IncidentsLogPage } from './features/dashboard/components/roles/IncidentsLogPage'
import { JustificationManager } from './features/attendance/pages/JustificationManager'
import { LatesPage } from './features/attendance/pages/LatesPage'
import { AbsenceManagerPage } from './features/absences/pages/AbsenceManagerPage'

import { SuperAdminDashboard } from './features/admin/pages/SuperAdminDashboard'
import { AdminDashboard } from './features/admin/pages/AdminDashboard'
import { PEMCPage } from './features/admin/pages/PEMCPage'
import { StaffControlCenter } from './features/admin/pages/StaffControlCenter'
import { AdminRouteSelector } from './features/admin/components/AdminRouteSelector'
import { SchoolStatsPage } from './features/dashboard/pages/SchoolStatsPage'
import { RoleSelectionPage } from './features/auth/pages/RoleSelectionPage'
import { TrackingPage } from './features/dashboard/components/roles/TrackingPage'
import { AuditOverviewPage } from './features/admin/pages/AuditOverviewPage'
import { ReportsRoute, AttendanceRoute } from './components/routes/RoleRoutes'
import { ProtectedRoute } from './components/routes/ProtectedRoute'
import { SubscriptionGuard } from './components/routes/SubscriptionGuard'

// Force rebuild

import { queryClient } from './lib/queryClient'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  console.log("NEMIA_SYNC_PROD_V4_ULTRA_FORCE_21:07")

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
      }
      if (event === 'SIGNED_IN') {
        queryClient.clear()
        // If we have payment params, stay on current URL or go home preserving them
        const search = window.location.search
        if (search.includes('status=')) {
          navigate(`/${search}`, { replace: true })
        }
      }
    })

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    // Check for payment callback params in the URL (Root Fallback Strategy)
    const handlePaymentCallback = () => {
      const params = new URLSearchParams(window.location.search)
      const status = params.get('status')
      const paymentId = params.get('payment_id')

      // In the new architecture, DashboardLayout handles the sync overlay at the root, 
      // so we don't need to redirect to /onboarding which would unmount the handler.
      if (window.location.pathname === '/' && status) {
        console.log('Payment callback detected at root, handling via DashboardLayout...')
      }
    }

    handlePaymentCallback()
  }, [navigate])

  useEffect(() => {
    // Deep Linking Listener
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', (data) => {
        console.log('App opened with URL:', data.url)
        // Extract path and query params from nemia://onboarding?status=approved
        // data.url format: nemia://onboarding?status=approved&...
        try {
          const urlObj = new URL(data.url)
          if (urlObj.host === 'onboarding') {
            const status = urlObj.searchParams.get('status')
            // Manually redirect via window location or router if available in context
            // Since this is outside Router context, we can use a window event or direct navigation
            if (status === 'approved') {
              navigate('/onboarding?status=approved')
            } else {
              navigate('/onboarding?status=failure')
            }
          }
        } catch (e) {
          console.error('Error parsing deep link:', e)
        }
      })
    })
  }, [navigate])

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>
  }

  return (
    <>
      <Routes>
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/select-role" element={session ? <RoleSelectionPage /> : <Navigate to={`/login${window.location.search}`} replace />} />
        <Route
          path="/"
          element={
            session ? (
              <SubscriptionGuard>
                <DashboardLayout />
              </SubscriptionGuard>
            ) : (
              <Navigate to={`/login${window.location.search}`} replace />
            )
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="teacher-dashboard" element={<TeacherDashboard />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="groups/:groupId" element={<GroupDetailsPage />} />
          <Route path="onboarding/*" element={<OnboardingWizard onComplete={() => window.location.href = '/'} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="evaluation/setup" element={<EvaluationSetupPage />} />
          <Route path="rubrics" element={<RubricListPage />} />
          <Route path="rubrics/new" element={<InstrumentBuilderPage />} />
          <Route path="rubrics/:id" element={<RubricEditorPage />} />
          <Route path="evaluation/formative" element={<FormativeToolsPage />} />
          <Route path="evaluation/portfolio" element={<StudentPortfolioPage />} />
          <Route path="gradebook" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'INDEPENDENT_TEACHER']}>
              <GradebookPage />
            </ProtectedRoute>
          } />
          <Route path="planning" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <PlanningListPage />
            </ProtectedRoute>
          } />
          <Route path="planning/new" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <PlanningEditorPage />
            </ProtectedRoute>
          } />
          <Route path="planning/:id" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <PlanningEditorPage />
            </ProtectedRoute>
          } />
          <Route path="analytical-program" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <AnalyticalProgramListPage />
            </ProtectedRoute>
          } />
          <Route path="analytical-program/new" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <AnalyticalProgramEditorPage />
            </ProtectedRoute>
          } />
          <Route path="analytical-program/:id" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <AnalyticalProgramEditorPage />
            </ProtectedRoute>
          } />
          <Route path="students" element={<StudentTrackingPage />} />
          <Route path="students/:studentId" element={<StudentTrackingPage />} />
          <Route path="tracking" element={<StudentTrackingPage />} />
          <Route path="tracking/:studentId" element={<StudentTrackingPage />} />
          <Route path="incidents" element={<IncidentsLogPage />} />
          <Route path="bap" element={<StudentTrackingPage />} />
          <Route path="stats" element={<SchoolStatsPage />} />
          <Route path="reports/student/:studentId" element={<StudentReportPage />} />
          <Route path="reports/evaluation" element={<EvaluationReportPage />} />
          <Route path="reports" element={<ReportsRoute />} />
          <Route path="messages" element={<ChatModule />} />
          <Route path="messages/:roomId" element={<ChatModule />} />
          <Route path="audit" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <AuditOverviewPage />
            </ProtectedRoute>
          } />

          {/* Admin Specific Routes */}
          <Route path="admin/dashboard" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="admin/pemc" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN']}>
              <PEMCPage />
            </ProtectedRoute>
          } />
          <Route path="admin/staff" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'PREFECT']}>
              <StaffControlCenter />
            </ProtectedRoute>
          } />

          <Route path="progress" element={<div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest">Módulo de Avance Programático en Desarrollo</div>} />
          <Route path="attendance" element={<AttendanceRoute />} />
          <Route path="attendance/staff" element={<StaffAttendancePortal />} />
          <Route path="attendance/justifications" element={<JustificationManager />} />
          <Route path="attendance/lates" element={<LatesPage />} />
          <Route path="substitutions" element={<SubstitutionDashboard />} />
          <Route path="citations" element={<CitationsPage />} />
          <Route path="interviews" element={<TrackingPage />} />
          <Route path="absences" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'INDEPENDENT_TEACHER', 'DIRECTOR']}>
              <AbsenceManagerPage />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
      <SpeedInsights />
    </>
  )
}

export default App
