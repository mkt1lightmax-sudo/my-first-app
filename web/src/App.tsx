import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute, { RequirePermission } from './components/ProtectedRoute'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import SurveyListPage from './pages/surveys/SurveyListPage'
import SurveyFormPage from './pages/surveys/SurveyFormPage'
import SurveyDetailPage from './pages/surveys/SurveyDetailPage'
import AppointmentsListPage from './pages/appointments/AppointmentsListPage'
import AppointmentFormPage from './pages/appointments/AppointmentFormPage'
import CalendarPage from './pages/appointments/CalendarPage'
import StaffListPage from './pages/staff/StaffListPage'
import StaffFormPage from './pages/staff/StaffFormPage'
import ChatThreadPage from './pages/chat/ChatThreadPage'
import ChatAccountsPage from './pages/chat/ChatAccountsPage'
import ChatReportPage from './pages/chat/ChatReportPage'
import ChatLayout, { ChatIndex } from './pages/chat/ChatLayout'
import PresentationPage from './pages/PresentationPage'
import TimeOffPage from './pages/appointments/TimeOffPage'
import SurveyTrashPage from './pages/surveys/SurveyTrashPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calculator" element={<PresentationPage />} />
              <Route path="/presentation" element={<Navigate to="/calculator" replace />} />
              <Route path="/surveys" element={<SurveyListPage />} />
              <Route path="/surveys/new" element={<RequirePermission permission="customers.create"><SurveyFormPage /></RequirePermission>} />
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />
              <Route path="/surveys/:id/edit" element={<RequirePermission permission="customers.edit"><SurveyFormPage /></RequirePermission>} />
              <Route path="/surveys/trash" element={<RequirePermission permission="customers.editAll"><SurveyTrashPage /></RequirePermission>} />
              <Route path="/appointments" element={<AppointmentsListPage />} />
              <Route path="/appointments/new" element={<RequirePermission permission="appointments.create"><AppointmentFormPage /></RequirePermission>} />
              <Route path="/appointments/:id/edit" element={<AppointmentFormPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/time-off" element={<TimeOffPage />} />
              <Route path="/staff" element={<StaffListPage />} />
              <Route path="/staff/new" element={<StaffFormPage />} />
              <Route path="/chat/accounts" element={<ChatAccountsPage />} />
              <Route path="/chat/report" element={<RequirePermission permission="reports.view"><ChatReportPage /></RequirePermission>} />
              <Route path="/chat" element={<ChatLayout />}>
                <Route index element={<ChatIndex />} />
                <Route path=":id" element={<RequirePermission permission="chat.view"><ChatThreadPage /></RequirePermission>} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
