import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute, { RequirePermission } from './components/ProtectedRoute'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import CalculatorPage from './pages/CalculatorPage'
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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/surveys" element={<SurveyListPage />} />
              <Route path="/surveys/new" element={<RequirePermission permission="customers.edit"><SurveyFormPage /></RequirePermission>} />
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />
              <Route path="/appointments" element={<AppointmentsListPage />} />
              <Route path="/appointments/new" element={<RequirePermission permission="appointments.create"><AppointmentFormPage /></RequirePermission>} />
              <Route path="/appointments/:id/edit" element={<AppointmentFormPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
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
