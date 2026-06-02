// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { saveReservations } from './services/reservationStore'
import type { Reservation } from './domain/types'

describe('app routes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
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

  it('renders Picktime-like admin controls for views, search, filters, and status', () => {
    saveReservations([
      reservation({
        firstName: 'Ana',
        lastName: 'Popescu',
        roomId: 'imeet',
        date: '2026-06-01',
        startTime: '09:00',
        status: 'pending',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /today/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^daily$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^weekly$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^monthly$/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/search booking/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument()
    expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0)
  })

  it('renders the Picktime-style daily resource grid by default', () => {
    saveReservations([
      reservation({
        firstName: 'Camelia',
        lastName: '',
        roomId: 'imeet',
        date: '2026-06-01',
        startTime: '11:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /^daily$/i })).toHaveClass('active')
    expect(screen.getByText(/Book iMEET Room/i)).toBeInTheDocument()
    expect(screen.getByText(/Book Loft Room/i)).toBeInTheDocument()
    expect(screen.getByText('8am')).toBeInTheDocument()
    expect(screen.getByText('8:30am')).toBeInTheDocument()
    expect(screen.getAllByText(/Camelia/).length).toBeGreaterThan(0)
  })

  it('opens a new booking modal for a dragged daily time range', () => {
    saveReservations([
      reservation({
        id: 'anchor',
        roomId: 'loft',
        date: '2026-06-01',
        startTime: '09:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.mouseDown(
      screen.getByLabelText('Select iMEET Room 2026-06-01 13:00'),
    )
    fireEvent.mouseEnter(
      screen.getByLabelText('Select iMEET Room 2026-06-01 15:00'),
    )

    expect(screen.getByText('1pm - 3pm')).toBeInTheDocument()

    fireEvent.mouseUp(
      screen.getByLabelText('Select iMEET Room 2026-06-01 15:00'),
    )

    expect(screen.getByRole('heading', { name: /new booking/i })).toBeInTheDocument()
    expect(screen.getByText(/2026-06-01, 13:00 - 15:00/i)).toBeInTheDocument()
  })

  it('opens a thirty-minute booking when only one daily grid square is selected', () => {
    saveReservations([
      reservation({
        id: 'anchor',
        roomId: 'loft',
        date: '2026-06-01',
        startTime: '09:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.mouseDown(
      screen.getByLabelText('Select iMEET Room 2026-06-01 13:00'),
    )
    fireEvent.mouseUp(
      screen.getByLabelText('Select iMEET Room 2026-06-01 13:00'),
    )

    expect(screen.getByRole('heading', { name: /new booking/i })).toBeInTheDocument()
    expect(screen.getByText(/2026-06-01, 13:00 - 13:30/i)).toBeInTheDocument()
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
    status: 'confirmed',
    notes: '',
    createdAt: '2026-05-31T12:00:00.000Z',
    ...overrides,
  }
}
