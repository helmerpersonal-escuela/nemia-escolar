import { Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { LoginPage } from './features/auth/pages/LoginPage'
const RegisterPage = lazyNamed(() => import('./features/auth/pages/RegisterPage'), 'RegisterPage')
const ResetPasswordPage = lazyNamed(() => import('./features/auth/pages/ResetPasswordPage'), 'ResetPasswordPage')
import { DashboardLayout } from './components/layout/DashboardLayout'
const DashboardPage = lazyNamed(() => import('./features/dashboard/pages/DashboardPage'), 'DashboardPage')
const GroupsPage = lazyNamed(() => import('./features/groups/pages/GroupsPage'), 'GroupsPage')
const GroupDetailsPage = lazyNamed(() => import('./features/groups/pages/GroupDetailsPage'), 'GroupDetailsPage')
const OnboardingWizard = lazyNamed(() => import('./features/onboarding/components/OnboardingWizard'), 'OnboardingWizard')
const SettingsPage = lazyNamed(() => import('./features/settings/pages/SettingsPage'), 'SettingsPage')
const SchedulePage = lazyNamed(() => import('./features/schedule/pages/SchedulePage'), 'SchedulePage')
const AgendaPage = lazyNamed(() => import('./features/agenda/pages/AgendaPage'), 'AgendaPage')
import { useState, useEffect, Suspense } from 'react'
import { lazyNamed } from './lib/lazyNamed'
import { SignupGate } from './features/auth/components/SignupGate'
import { NotFoundPage } from './components/common/NotFoundPage'
import { handleAuthDeepLink } from './features/auth/lib/googleAuth'
import { PageLoader } from './components/common/PageLoader'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'

const TeacherDashboard = lazyNamed(() => import('./features/evaluation/pages/TeacherDashboard'), 'TeacherDashboard')
const EvaluationSetupPage = lazyNamed(() => import('./features/evaluation/pages/EvaluationSetupPage'), 'EvaluationSetupPage')
const RubricListPage = lazyNamed(() => import('./features/rubrics/pages/RubricListPage'), 'RubricListPage')
const RubricEditorPage = lazyNamed(() => import('./features/rubrics/pages/RubricEditorPage'), 'RubricEditorPage')
const InstrumentBuilderPage = lazyNamed(() => import('./features/rubrics/pages/InstrumentBuilderPage'), 'InstrumentBuilderPage')
const FormativeToolsPage = lazyNamed(() => import('./features/evaluation/pages/FormativeToolsPage'), 'FormativeToolsPage')
const StudentPortfolioPage = lazyNamed(() => import('./features/evaluation/pages/StudentPortfolioPage'), 'StudentPortfolioPage')
const GradebookPage = lazyNamed(() => import('./features/evaluation/pages/GradebookPage'), 'GradebookPage')
const PlanningListPage = lazyNamed(() => import('./features/planning/pages/PlanningListPage'), 'PlanningListPage')
const PlanningEditorPage = lazyNamed(() => import('./features/planning/pages/PlanningEditorPage'), 'PlanningEditorPage')
const StudentTrackingPage = lazyNamed(() => import('./features/students/pages/StudentTrackingPage'), 'StudentTrackingPage')
const StudentReportPage = lazyNamed(() => import('./features/reports/pages/StudentReportPage'), 'StudentReportPage')
const AnalyticalProgramListPage = lazyNamed(() => import('./features/analytical-program/pages/AnalyticalProgramListPage'), 'AnalyticalProgramListPage')
const AnalyticalProgramEditorPage = lazyNamed(() => import('./features/analytical-program/pages/AnalyticalProgramEditorPage'), 'AnalyticalProgramEditorPage')
const EvaluationReportPage = lazyNamed(() => import('./features/evaluation/pages/EvaluationReportPage'), 'EvaluationReportPage')
const ChatModule = lazyNamed(() => import('./features/communications/ChatModule'), 'ChatModule')
const StaffAttendancePortal = lazyNamed(() => import('./features/attendance/pages/StaffAttendancePortal'), 'StaffAttendancePortal')
const SubstitutionDashboard = lazyNamed(() => import('./features/attendance/pages/SubstitutionDashboard'), 'SubstitutionDashboard')
const CitationsPage = lazyNamed(() => import('./features/attendance/pages/CitationsPage'), 'CitationsPage')
const JustificationManager = lazyNamed(() => import('./features/attendance/pages/JustificationManager'), 'JustificationManager')
const LatesPage = lazyNamed(() => import('./features/attendance/pages/LatesPage'), 'LatesPage')
const AbsenceManagerPage = lazyNamed(() => import('./features/absences/pages/AbsenceManagerPage'), 'AbsenceManagerPage')
const PaywallPage = lazyNamed(() => import('./features/subscription/pages/PaywallPage'), 'PaywallPage')
const LandingPage = lazyNamed(() => import('./features/marketing/pages/LandingPage'), 'LandingPage')

const SuperAdminDashboard = lazyNamed(() => import('./features/admin/pages/SuperAdminDashboard'), 'SuperAdminDashboard')
const AdminDashboard = lazyNamed(() => import('./features/admin/pages/AdminDashboard'), 'AdminDashboard')
const PEMCPage = lazyNamed(() => import('./features/admin/pages/PEMCPage'), 'PEMCPage')
const StaffControlCenter = lazyNamed(() => import('./features/admin/pages/StaffControlCenter'), 'StaffControlCenter')
const SchoolStatsPage = lazyNamed(() => import('./features/dashboard/pages/SchoolStatsPage'), 'SchoolStatsPage')
const RoleSelectionPage = lazyNamed(() => import('./features/auth/pages/RoleSelectionPage'), 'RoleSelectionPage')
const TrackingPage = lazyNamed(() => import('./features/dashboard/components/roles/TrackingPage'), 'TrackingPage')
const AuditOverviewPage = lazyNamed(() => import('./features/admin/pages/AuditOverviewPage'), 'AuditOverviewPage')
const ReportsRoute = lazyNamed(() => import('./components/routes/RoleRoutes'), 'ReportsRoute')
const AttendanceRoute = lazyNamed(() => import('./components/routes/RoleRoutes'), 'AttendanceRoute')
const IncidentsRoute = lazyNamed(() => import('./components/routes/RoleRoutes'), 'IncidentsRoute')
import { ProtectedRoute } from './components/routes/ProtectedRoute'
import { SubscriptionGuard } from './components/routes/SubscriptionGuard'
const CTEPage = lazyNamed(() => import('./features/cte/pages/CTEPage'), 'CTEPage')
const TextbooksPage = lazyNamed(() => import('./features/textbooks/pages/TextbooksPage'), 'TextbooksPage')
const CompleteSignupPage = lazyNamed(() => import('./features/auth/pages/CompleteSignupPage'), 'CompleteSignupPage')
const LegalPage = lazyNamed(() => import('./features/legal/LegalPage'), 'LegalPage')
const NemAssistantPage = lazyNamed(() => import('./features/nem-assistant/pages/NemAssistantPage'), 'NemAssistantPage')

// Force rebuild

import { queryClient } from './lib/queryClient'
import { clearCache } from './lib/offline/cache'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      // Hide SplashScreen once app is ready
      if (Capacitor.isNativePlatform()) {
        SplashScreen.hide().catch((err: any) => console.warn('SplashScreen hide error:', err))
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        // No dejar en el dispositivo datos de alumnos del docente que cerró sesión.
        // (Los cambios que aún no se envían se conservan y solo se suben con SU sesión.)
        void clearCache('gradebook')
        void clearCache('rq:')
        sessionStorage.removeItem('vunlek_impersonate_id')
      }
      if (event === 'SIGNED_IN') {
        queryClient.clear()
        // If we have payment params, stay on current URL or go home preserving them
        const search = window.location.search
        if (search.includes('status=')) {
          navigate(`/${search}`, { replace: true })
        }
      }
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
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
        // Extract path and query params from vunlek://onboarding?status=approved
        // data.url format: vunlek://onboarding?status=approved&...
        try {
          if (data.url.startsWith('vunlek://auth')) {
            handleAuthDeepLink(data.url)
              .then(() => navigate('/complete-signup', { replace: true }))
              .catch((err) => { console.error('Error al volver de Google:', err); navigate('/login') })
            return
          }
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
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
            <SuperAdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={session ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacidad" element={<LegalPage kind="privacy" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/terminos" element={<LegalPage kind="terms" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/complete-signup" element={session ? <CompleteSignupPage /> : <Navigate to="/login" replace />} />
        <Route path="/select-role" element={session ? <RoleSelectionPage /> : <Navigate to={`/login${window.location.search}`} replace />} />
        <Route
          path="/"
          element={
            session ? (
              <SignupGate userId={session.user.id}>
                <SubscriptionGuard>
                  <DashboardLayout />
                </SubscriptionGuard>
              </SignupGate>
            ) : (
              Capacitor.isNativePlatform() ? <Navigate to="/login" replace /> : <LandingPage />
            )
          }
        >
          <Route path="paywall" element={<PaywallPage />} />
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
          <Route path="incidents" element={<IncidentsRoute />} />
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
          <Route path="nem-assistant" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'INDEPENDENT_TEACHER']}>
              <NemAssistantPage />
            </ProtectedRoute>
          } />

          <Route path="cte" element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD']}>
              <CTEPage />
            </ProtectedRoute>
          } />
          <Route path="libros" element={<TextbooksPage />} />

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

          <Route path="progress" element={<div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">Módulo de Avance Programático en Desarrollo</div>} />
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
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </Suspense>
      <SpeedInsights />
    </>
  )
}

export default App
