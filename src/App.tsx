import { Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { AppShell } from './components/AppShell'
import { AdminCalendarPage } from './pages/AdminCalendarPage'
import { RoomBookingPage, UserBookingPage } from './pages/UserBookingPage'
import { getAdminLoginUrl, hasAdminApiToken } from './services/bookingApi'
import './styles.css'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<UserBookingPage />} />
        <Route path="/rooms/:roomId" element={<RoomBookingPage />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminCalendarPage />
            </RequireAdmin>
          }
        />
      </Routes>
    </AppShell>
  )
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const isAdmin = hasAdminApiToken()

  useEffect(() => {
    if (!isAdmin) {
      window.location.assign(getAdminLoginUrl())
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <section className="auth-redirect-panel" aria-live="polite">
        <h1>Admin login required</h1>
        <p>Te redirectionam catre autentificarea pentru admin.</p>
      </section>
    )
  }

  return children
}
