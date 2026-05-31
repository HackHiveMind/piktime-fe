// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { saveReservations } from './services/reservationStore'
import type { Reservation } from './domain/types'

describe('app routes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders the public booking interface', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /rezerva o sala/i })).toBeInTheDocument()
    expect(screen.getAllByText('iMEET Room').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin')
  })

  it('renders admin calendar with existing reservation details', () => {
    saveReservations([
      reservation({
        firstName: 'Ana',
        lastName: 'Popescu',
        roomId: 'imeet',
        date: '2026-06-01',
        startTime: '09:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /calendar admin/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Ana Popescu/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/iMEET Room/).length).toBeGreaterThan(0)
  })
})

function reservation(overrides: Partial<Reservation>): Reservation {
  return {
    id: 'reservation-default',
    roomId: 'imeet',
    date: '2026-06-01',
    startTime: '09:00',
    endTime: '10:00',
    firstName: 'Default',
    lastName: 'Guest',
    email: 'guest@example.com',
    phone: '060000000',
    createdAt: '2026-05-31T12:00:00.000Z',
    ...overrides,
  }
}
