import { CalendarDays, LayoutDashboard } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label="iHUB Moldova booking">
          <img src="/ihub-logo.png" alt="iHUB Moldova" className="brand-logo" />
          <span>
            <strong>iHUB Moldova</strong>
            <small>Meeting room booking</small>
          </span>
        </NavLink>

        <nav className="nav-tabs" aria-label="Navigatie principala">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <CalendarDays size={18} />
            Booking
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            <LayoutDashboard size={18} />
            Admin
          </NavLink>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  )
}
