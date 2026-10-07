import { Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { LoginPage } from './features/auth/pages/LoginPage'
const RegisterPage = lazyNamed(() => import('./features/auth/pages/RegisterPage'), 'RegisterPage')
const InvitationPage = lazyNamed(() => import('./features/auth/pages/InvitationPage'), 'InvitationPage')
const ResetPasswordPage = lazyNamed(() => import('./features/auth/pages/ResetPasswordPage'), 'ResetPasswordPage')
import { DashboardLayout } from './components/layout/DashboardLayout'
const DashboardPage = lazyNamed(() => import('./features/dashboard/pages/DashboardPage'), 'DashboardPage')
const GroupsPage = lazyNamed(() => import('./features/groups/pages/GroupsPage'), 'GroupsPage')
const GroupDetailsPage = lazyNamed(() => import('./features/groups/pages/GroupDetailsPage'), 'GroupDetailsPage')
const OnboardingWizard = lazyNamed(() => import('./features/onboarding/components/OnboardingWizard'), 'OnboardingWizard')
const SettingsPage = lazyNamed(() => import('./features/settings/pages/SettingsPage'), 'SettingsPage')
const SchedulePage = lazyNamed(() => import('./features/schedule/pages/SchedulePage'), 'SchedulePage')
const AgendaPage = lazyNamed(() => import('./features/agenda/pages/AgendaPage'), 'AgendaPage')
import { useState, useEffect, useRef, Suspense } from 'react'
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
const SubscriptionPage = lazyNamed(() => import('./features/subscription/pages/SubscriptionPage'), 'SubscriptionPage')
const DeleteAccountPage = lazyNamed(() => import('./features/legal/DeleteAccountPage'), 'DeleteAccountPage')
const SchoolQuotePage = lazyNamed(() => import('./features/sales/SchoolQuotePage'), 'SchoolQuotePage')
const SchoolQuoteAppPage = lazyNamed(() => import('./features/sales/SchoolQuoteAppPage'), 'SchoolQuoteAppPage')
const LandingPage = lazyNamed(() => import('./features/marketing/pages/LandingPage'), 'LandingPage')

const SuperAdminDashboard = lazyNamed(() => import('./features/admin/pages/SuperAdminDashboard'), 'SuperAdminDashboard')
const AdminDashboard = lazyNamed(() => import('./features/admin/pages/AdminDashboard'), 'AdminDashboard')
const PEMCPage = lazyNamed(() => import('./features/admin/pages/PEMCPage'), 'PEMCPage')
const InstrumentsPage = lazyNamed(() => import('./features/instruments/pages/InstrumentsPage'), 'InstrumentsPage')
const MyVisitsPage = lazyNamed(() => import('./features/direction/pages/MyVisitsPage'), 'MyVisitsPage')
const DirectionLogPage = lazyNamed(() => import('./features/direction/pages/DirectionLogPage'), 'DirectionLogPage')
const StudentLookupPage = lazyNamed(() => import('./features/students/pages/StudentLookupPage'), 'StudentLookupPage')
const StaffControlCenter = lazyNamed(() => import('./features/admin/pages/StaffControlCenter'), 'StaffControlCenter')
const SchoolStatsPage = lazyNamed(() => import('./features/dashboard/pages/SchoolStatsPage'), 'SchoolStatsPage')
const RoleSelectionPage = lazyNamed(() => import('./features/auth/pages/RoleSelectionPage'), 'RoleSelectionPage')
const TrackingPage = lazyNamed(() => import('./features/dashboard/components/roles/TrackingPage'), 'TrackingPage')
const AuditOverviewPage = lazyNamed(() => import('./features/admin/pages/AuditOverviewPage'), 'AuditOverviewPage')
const ReportsRoute = lazyNamed(() => import('./components/routes/RoleRoutes'), 'ReportsRoute')
const AttendanceRoute = lazyNamed(() => import('./components/routes/RoleRoutes'), 'AttendanceRoute')
const IncidentsRoute = lazyNamed(() => import('./components/routes/RoleRoutes'), 'IncidentsRoute')
import { ProtectedRoute } from './components/routes/ProtectedRoute'
import { RequireSteps } from './components/prereq/Prerequisites'
import { SubscriptionGuard } from './components/routes/SubscriptionGuard'
import { BILLING_ENABLED } from './lib/billing'
const CTEPage = lazyNamed(() => import('./features/cte/pages/CTEPage'), 'CTEPage')
const NewSchoolYearWizard = lazyNamed(() => import('./features/school-year/pages/NewSchoolYearWizard'), 'NewSchoolYearWizard')
const CooperativePage = lazyNamed(() => import('./features/cooperative/pages/CooperativePage'), 'CooperativePage')
const TextbooksPage = lazyNamed(() => import('./features/textbooks/pages/TextbooksPage'), 'TextbooksPage')
const CompleteSignupPage = lazyNamed(() => import('./features/auth/pages/CompleteSignupPage'), 'CompleteSignupPage')
const LegalPage = lazyNamed(() => import('./features/legal/LegalPage'), 'LegalPage')
const FamilyAccessPage = lazyNamed(() => import('./features/family/pages/FamilyAccessPage'), 'FamilyAccessPage')
const FamilyCodesPage = lazyNamed(() => import('./features/family/pages/FamilyCodesPage'), 'FamilyCodesPage')
const SchoolImportPage = lazyNamed(() => import('./features/school-import/pages/SchoolImportPage'), 'SchoolImportPage')
const SupportRequestsPage = lazyNamed(() => import('./features/support/pages/SupportRequestsPage'), 'SupportRequestsPage')
const MergeWorkspacePage = lazyNamed(() => import('./features/workspace-merge/MergeWorkspacePage'), 'MergeWorkspacePage')
const AccessControlPage = lazyNamed(() => import('./features/cards/pages/AccessControlPage'), 'AccessControlPage')
const CardsPage = lazyNamed(() => import('./features/cards/pages/CardsPage'), 'CardsPage')
const CardLandingPage = lazyNamed(() => import('./features/cards/pages/CardLandingPage'), 'CardLandingPage')
const ExtraAccessPage = lazyNamed(() => import('./features/family/pages/ExtraAccessPage'), 'ExtraAccessPage')
const FamilyAccessAdminPage = lazyNamed(() => import('./features/family/pages/FamilyAccessAdminPage'), 'FamilyAccessAdminPage')
const ActivityLogPage = lazyNamed(() => import('./features/support/pages/ActivityLogPage'), 'ActivityLogPage')
const AdvisoryGroupPage = lazyNamed(() => import('./features/advisory/pages/AdvisoryGroupPage'), 'AdvisoryGroupPage')
const PedagogyCatalogPage = lazyNamed(() => import('./features/pdas/pages/PedagogyCatalogPage'), 'PedagogyCatalogPage')
const FormatsPage = lazyNamed(() => import('./features/formats/pages/FormatsPage'), 'FormatsPage')
const InstrumentViewPage = lazyNamed(() => import('./features/rubrics/pages/InstrumentViewPage'), 'InstrumentViewPage')
const NemAssistantPage = lazyNamed(() => import('./features/nem-assistant/pages/NemAssistantPage'), 'NemAssistantPage')

// Force rebuild

import { queryClient } from './lib/queryClient'
import { clearCache } from './lib/offline/cache'

/** Si alguien abrió una invitación y fue a iniciar sesión, al volver lo regresamos a ella. */
function pendingInvitePath(): string | null {
  try {
    const t = localStorage.getItem('vunlek.pendingInvite')
    return t ? `/invitacion?token=${encodeURIComponent(t)}` : null
  } catch { return null }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  // Tras entrar (también con Google), retoma la invitación pendiente
  useEffect(() => {
    if (!session) return
    const target = pendingInvitePath()
    if (target && !window.location.pathname.startsWith('/invitacion')) navigate(target, { replace: true })
  }, [session])
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  // Usuario con el que se cargaron los datos en caché. Supabase vuelve a emitir SIGNED_IN
  // cada vez que la pestaña/ventana regresa de estar oculta (minimizar y maximizar);
  // solo hay que limpiar la caché si de verdad cambió la cuenta.
  const currentUserIdRef = useRef<string | null>(null)


  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserIdRef.current = session?.user?.id ?? null
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
      const previousUserId = currentUserIdRef.current
      const nextUserId = session?.user?.id ?? null
      currentUserIdRef.current = nextUserId
      // Misma cuenta y mismo token: no re-renderizar toda la app (evita que se desmonten
      // formularios y se pierda lo capturado al volver a la ventana).
      setSession(prev =>
        prev && session && prev.user?.id === session.user?.id && prev.access_token === session.access_token
          ? prev
          : session
      )
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        // No dejar en el dispositivo datos de alumnos del docente que cerró sesión.
        // (Los cambios que aún no se envían se conservan y solo se suben con SU sesión.)
        void clearCache('gradebook')
        void clearCache('rq:')
        sessionStorage.removeItem('vunlek_impersonate_id')
      }
      if (event === 'SIGNED_IN' && previousUserId !== nextUserId) {
        // Solo al entrar con otra cuenta. Antes se borraba toda la caché cada vez que la
        // ventana volvía a primer plano: la app mostraba "cargando", desmontaba la pantalla
        // actual y se perdía lo que el usuario llevaba escrito.
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
        <Route path="/login" element={session ? <Navigate to={pendingInvitePath() ?? '/'} replace /> : <LoginPage />} />
        {/* Con sesión, un enlace de invitación (/register?token=…) va a la pantalla para aceptarla */}
        <Route path="/register" element={session ? <Navigate to={new URLSearchParams(window.location.search).get('token') ? `/invitacion${window.location.search}` : '/'} replace /> : <RegisterPage />} />
        <Route path="/invitacion" element={<InvitationPage />} />
        <Route path="/familia" element={<FamilyAccessPage />} />
        <Route path="/c/:token" element={<CardLandingPage />} />
        <Route path="/familia/adicional" element={<ExtraAccessPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/escuelas" element={<SchoolQuotePage />} />
        <Route path="/eliminar-cuenta" element={<DeleteAccountPage />} />
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
          <Route path="paywall" element={<Navigate to={`/suscripcion${window.location.search}`} replace />} />
          <Route path="suscripcion" element={BILLING_ENABLED ? <SubscriptionPage /> : <Navigate to="/" replace />} />
          <Route index element={<DashboardPage />} />
          <Route path="teacher-dashboard" element={<TeacherDashboard />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="groups/:groupId" element={<GroupDetailsPage />} />
          <Route path="importar-datos" element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD']}>
              <SchoolImportPage />
            </ProtectedRoute>
          } />
          <Route path="familias/codigos" element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD']}>
              <RequireSteps steps={['tutores']} action="generar los códigos para familias"><FamilyCodesPage /></RequireSteps>
            </ProtectedRoute>
          } />
          <Route path="solicitudes" element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'PREFECT', 'SUPPORT']}>
              <SupportRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="presupuesto" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'SYSTEM_ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD']}>
              <SchoolQuoteAppPage />
            </ProtectedRoute>
          } />
          <Route path="sumar-mi-espacio" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'PREFECT', 'SUPPORT', 'INDEPENDENT_TEACHER']}>
              <MergeWorkspacePage />
            </ProtectedRoute>
          } />
          <Route path="acceso" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'PREFECT', 'SUPPORT']}>
              <RequireSteps steps={['alumnos']} action="registrar entradas con credencial"><AccessControlPage /></RequireSteps>
            </ProtectedRoute>
          } />
          <Route path="credenciales" element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD', 'TECH_COORD', 'PREFECT', 'TEACHER', 'INDEPENDENT_TEACHER']}>
              <RequireSteps steps={['alumnos']} action="preparar las credenciales"><CardsPage /></RequireSteps>
            </ProtectedRoute>
          } />
          <Route path="familias/accesos" element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN', 'SCHOOL_CONTROL', 'ACADEMIC_COORD']}>
              <FamilyAccessAdminPage />
            </ProtectedRoute>
          } />
          <Route path="bitacora" element={
            <ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'DIRECTOR', 'ADMIN']}>
              <ActivityLogPage />
            </ProtectedRoute>
          } />
          <Route path="onboarding/*" element={<OnboardingWizard onComplete={() => window.location.href = '/'} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="schedule" element={<RequireSteps steps={['jornada', 'materias']} action="ver o armar el horario"><SchedulePage /></RequireSteps>} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="formatos" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'INDEPENDENT_TEACHER', 'DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD']}>
              <FormatsPage />
            </ProtectedRoute>
          } />
          <Route path="asesoria" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'INDEPENDENT_TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'PREFECT']}>
              <AdvisoryGroupPage />
            </ProtectedRoute>
          } />
          <Route path="evaluation/setup" element={<RequireSteps steps={['ciclo', 'asignacion']} action="configurar la evaluación"><EvaluationSetupPage /></RequireSteps>} />
          <Route path="rubrics" element={<RubricListPage />} />
          <Route path="rubrics/new" element={<InstrumentBuilderPage />} />
          <Route path="rubrics/ver/:id" element={<InstrumentViewPage />} />
          <Route path="rubrics/:id" element={<RubricEditorPage />} />
          <Route path="evaluation/formative" element={<FormativeToolsPage />} />
          <Route path="evaluation/portfolio" element={<StudentPortfolioPage />} />
          <Route path="gradebook" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'INDEPENDENT_TEACHER']}>
              <RequireSteps steps={['asignacion', 'alumnos', 'ciclo']} action="pasar lista o calificar"><GradebookPage /></RequireSteps>
            </ProtectedRoute>
          } />
          <Route path="planning" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <PlanningListPage />
            </ProtectedRoute>
          } />
          <Route path="planning/new" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ACADEMIC_COORD', 'INDEPENDENT_TEACHER']}>
              <RequireSteps steps={['asignacion', 'ciclo']} action="hacer una planeación"><PlanningEditorPage /></RequireSteps>
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
          <Route path="diagnostico" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'PREFECT', 'SUPPORT', 'SOCIAL_WORKER']}>
              <InstrumentsPage />
            </ProtectedRoute>
          } />
          <Route path="mis-visitas" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD']}>
              <MyVisitsPage />
            </ProtectedRoute>
          } />
          <Route path="direccion/bitacora" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'TECH_COORD']}>
              <DirectionLogPage />
            </ProtectedRoute>
          } />
          <Route path="bap" element={<StudentTrackingPage />} />
          <Route path="stats" element={<RequireSteps steps={['alumnos']} action="ver las estadísticas"><SchoolStatsPage /></RequireSteps>} />
          <Route path="reports/student/:studentId" element={<StudentReportPage />} />
          <Route path="reports/evaluation" element={<RequireSteps steps={['alumnos', 'ciclo']} action="generar boletas"><EvaluationReportPage /></RequireSteps>} />
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
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'INDEPENDENT_TEACHER']}>
              <CTEPage />
            </ProtectedRoute>
          } />
          <Route path="libros" element={<TextbooksPage />} />
          <Route path="nuevo-ciclo" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'SCHOOL_CONTROL', 'INDEPENDENT_TEACHER']}>
              <NewSchoolYearWizard />
            </ProtectedRoute>
          } />
          <Route path="mis-pdas" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'INDEPENDENT_TEACHER']}>
              <PedagogyCatalogPage />
            </ProtectedRoute>
          } />
          <Route path="cooperativa" element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DIRECTOR', 'ACADEMIC_COORD', 'TECH_COORD', 'TEACHER', 'INDEPENDENT_TEACHER']}>
              <CooperativePage />
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
          <Route path="alumnos/consulta" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'SCHOOL_CONTROL', 'PREFECT', 'SUPPORT', 'TECH_COORD']}>
              <StudentLookupPage />
            </ProtectedRoute>
          } />
          <Route path="admin/staff" element={
            <ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN', 'ACADEMIC_COORD', 'PREFECT']}>
              <StaffControlCenter />
            </ProtectedRoute>
          } />

          <Route path="progress" element={<div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">Módulo de Avance Programático en Desarrollo</div>} />
          <Route path="attendance" element={<AttendanceRoute />} />
          <Route path="attendance/staff" element={<StaffAttendancePortal />} />
          <Route path="attendance/justifications" element={<JustificationManager />} />
          <Route path="attendance/lates" element={<LatesPage />} />
          <Route path="substitutions" element={<RequireSteps steps={['jornada', 'materias']} action="cubrir suplencias"><SubstitutionDashboard /></RequireSteps>} />
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
