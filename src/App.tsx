import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { AdminCalendarPage } from './pages/AdminCalendarPage'
import { RoomBookingPage, UserBookingPage } from './pages/UserBookingPage'
import './styles.css'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<UserBookingPage />} />
        <Route path="/rooms/:roomId" element={<RoomBookingPage />} />
        <Route path="/admin" element={<AdminCalendarPage />} />
      </Routes>
    </AppShell>
  )
}
