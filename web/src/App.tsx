import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
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
              <Route path="/surveys/new" element={<SurveyFormPage />} />
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />
              <Route path="/appointments" element={<AppointmentsListPage />} />
              <Route path="/appointments/new" element={<AppointmentFormPage />} />
              <Route path="/appointments/:id/edit" element={<AppointmentFormPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/staff" element={<StaffListPage />} />
              <Route path="/staff/new" element={<StaffFormPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
