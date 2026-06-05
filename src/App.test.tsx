// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { getReservations, saveReservations, saveRoomBlocks } from './services/reservationStore'
import type { Reservation, RoomBlock } from './domain/types'

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
    expect(screen.getByRole('button', { name: /09:30Liber/i })).toBeInTheDocument()
  })

  it('marks user slots blocked by admin room blocks as unavailable', () => {
    saveRoomBlocks([
      roomBlock({
        roomId: 'imeet',
        startTime: '13:00',
        endTime: '15:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /13:00Blocat/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /14:30Blocat/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /15:00Liber/i })).not.toBeDisabled()
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

  it('lets admin create and remove indefinite room blocks', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /block time/i }))
    fireEvent.change(screen.getByLabelText(/^room$/i), { target: { value: 'imeet' } })
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '13:00' } })
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '15:00' } })
    fireEvent.click(screen.getByRole('button', { name: /block room/i }))

    expect(screen.getByText(/Blocked indefinitely/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Blocked iMEET Room 1pm - 3pm/i }))
    fireEvent.click(screen.getByRole('button', { name: /unblock/i }))

    expect(screen.queryByText(/Blocked indefinitely/i)).not.toBeInTheDocument()
  })

  it('lets admin create bookings on multiple dates and skips occupied dates', () => {
    saveReservations([
      reservation({
        id: 'existing-conflict',
        roomId: 'imeet',
        date: '2026-06-03',
        startTime: '13:00',
        endTime: '15:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /new booking/i }))
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: '2026-06-02' } })
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '13:00' } })
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '15:00' } })
    fireEvent.change(screen.getByLabelText(/^additional date$/i), {
      target: { value: '2026-06-03' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add date/i }))
    fireEvent.change(screen.getByLabelText(/^additional date$/i), {
      target: { value: '2026-06-04' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add date/i }))
    expect(screen.getByRole('button', { name: /remove 2026-06-03/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove 2026-06-04/i })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/^nume$/i), { target: { value: 'Marin' } })
    fireEvent.change(screen.getByLabelText(/prenume/i), { target: { value: 'Ion' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ion@example.com' } })
    fireEvent.change(screen.getByLabelText(/telefon/i), { target: { value: '060111222' } })
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    expect(screen.getByText(/Created 2 bookings/i)).toBeInTheDocument()
    expect(screen.getByText(/Skipped 1 occupied date/i)).toBeInTheDocument()
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-06-02', startTime: '13:00', endTime: '15:00' }),
        expect.objectContaining({ date: '2026-06-04', startTime: '13:00', endTime: '15:00' }),
      ]),
    )
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toHaveLength(2)
  })

  it('copies an existing admin booking into new bookings on multiple dates', () => {
    saveReservations([
      reservation({
        id: 'copy-source',
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@example.com',
        roomId: 'imeet',
        date: '2026-06-01',
        startTime: '11:00',
        endTime: '12:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Ana Popescu/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy booking/i }))
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: '2026-06-08' } })
    fireEvent.change(screen.getByLabelText(/^additional date$/i), {
      target: { value: '2026-06-09' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add date/i }))
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    expect(screen.getByText(/Created 2 bookings/i)).toBeInTheDocument()
    expect(getReservations().filter((item) => item.email === 'ana@example.com')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-06-08', roomId: 'imeet', startTime: '11:00' }),
        expect.objectContaining({ date: '2026-06-09', roomId: 'imeet', startTime: '11:00' }),
      ]),
    )
    expect(getReservations().filter((item) => item.email === 'ana@example.com')).toHaveLength(3)
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

function roomBlock(overrides: Partial<RoomBlock>): RoomBlock {
  return {
    id: 'block-default',
    roomId: 'imeet',
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
    createdAt: '2026-05-31T12:00:00.000Z',
    ...overrides,
  }
}
