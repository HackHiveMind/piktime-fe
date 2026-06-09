// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getReservations, saveReservations, saveRoomBlocks } from './services/reservationStore'
import type { Reservation, RoomBlock } from './domain/types'

describe('app routes', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
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

  it('submits a public booking to the backend api', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/rooms')) {
        return jsonResponse({
          data: [{ id: 'imeet', name: 'iMEET Room', capacity: 8 }],
        })
      }

      if (url.includes('/api/rooms/imeet/availability')) {
        return jsonResponse({
          data: {
            room_id: 'imeet',
            date: '2026-06-01',
            slots: [{ start: '09:00', end: '10:00', label: '09:00 - 10:00', available: true }],
          },
        })
      }

      if (url.endsWith('/api/reservations') && init?.method === 'POST') {
        return jsonResponse({
          data: {
            id: '42',
            room_id: 'imeet',
            date: new Date().toISOString().slice(0, 10),
            start_time: '09:00',
            end_time: '10:00',
            first_name: 'Ana',
            last_name: 'Popescu',
            email: 'ana@example.com',
            phone: '069123456',
            status: 'confirmed',
            notes: '',
            created_at: '2026-06-05T12:00:00.000000Z',
          },
        }, 201)
      }

      return jsonResponse({ data: { slots: [] } })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /09:00Liber/i }))
    fireEvent.change(screen.getByLabelText(/^nume$/i), { target: { value: 'Popescu' } })
    fireEvent.change(screen.getByLabelText(/prenume/i), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText(/telefon/i), { target: { value: '069123456' } })
    fireEvent.click(screen.getByRole('button', { name: /confirma rezervarea/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/reservations',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(screen.getByText(/Rezervare confirmata pentru iMEET Room/i)).toBeInTheDocument()
  })

  it('shows a visible public booking validation message before api submit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/api/rooms')) {
          return jsonResponse({
            data: [{ id: 'imeet', name: 'iMEET Room', capacity: 8 }],
          })
        }

        return jsonResponse({
          data: {
            room_id: 'imeet',
            date: '2026-06-01',
            slots: [{ start: '09:00', end: '10:00', label: '09:00 - 10:00', available: true }],
          },
        })
      }),
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /09:00Liber/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirma rezervarea/i }))

    expect(screen.getByText(/Completeaza numele/i)).toBeInTheDocument()
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

  it('loads admin reservations from the backend instead of only local storage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            {
              id: 'backend-reservation',
              room_id: 'imeet',
              date: '2026-06-01',
              start_time: '09:00',
              end_time: '10:00',
              first_name: 'Maria',
              last_name: 'Ionescu',
              email: 'maria@example.com',
              phone: '060111222',
              status: 'confirmed',
              notes: null,
              created_at: '2026-06-05T12:00:00.000000Z',
            },
          ],
        }),
      ),
    )

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getReservations()).toEqual([
        expect.objectContaining({
          id: 'backend-reservation',
          firstName: 'Maria',
          lastName: 'Ionescu',
        }),
      ])
    })
    expect(screen.getAllByText(/Maria Ionescu/).length).toBeGreaterThan(0)
    expect(getReservations()).toEqual([
      expect.objectContaining({
        id: 'backend-reservation',
        firstName: 'Maria',
        lastName: 'Ionescu',
      }),
    ])
  })

  it('deletes admin reservations from the backend before removing them locally', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/reservations') && !init) {
        return jsonResponse({
          data: [
            {
              id: 'backend-reservation',
              room_id: 'imeet',
              date: '2026-06-01',
              start_time: '09:00',
              end_time: '10:00',
              first_name: 'Maria',
              last_name: 'Ionescu',
              email: 'maria@example.com',
              phone: '060111222',
              status: 'confirmed',
              notes: null,
              created_at: '2026-06-05T12:00:00.000000Z',
            },
          ],
        })
      }

      if (url.endsWith('/api/admin/reservations/backend-reservation') && init?.method === 'DELETE') {
        return jsonResponse(null, 204)
      }

      return jsonResponse({ message: 'Unexpected API request' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('button', { name: /Maria Ionescu/i })
    fireEvent.click(screen.getByRole('button', { name: /Maria Ionescu/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete booking/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/admin/reservations/backend-reservation',
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
    expect(getReservations()).toEqual([])
    expect(screen.getByText(/Booking removed/i)).toBeInTheDocument()
  })

  it('lets the backend decide when a stale local admin reservation looks conflicting', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/reservations') && !init) {
        return jsonResponse({ message: 'Temporary load failure' }, 500)
      }

      if (url.endsWith('/api/admin/reservations') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))

        return jsonResponse({
          data: {
            id: 'backend-created',
            room_id: body.room_id,
            date: body.date,
            start_time: body.start_time,
            end_time: body.end_time,
            first_name: body.first_name,
            last_name: body.last_name,
            email: body.email,
            phone: body.phone,
            status: body.status,
            notes: body.notes,
            created_at: '2026-06-05T12:00:00.000000Z',
          },
        }, 201)
      }

      return jsonResponse({ message: 'Unexpected API request' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    saveReservations([
      reservation({
        id: 'stale-local',
        roomId: 'imeet',
        date: '2026-06-01',
        startTime: '09:00',
        endTime: '10:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /new booking/i }))
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: '2026-06-01' } })
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText(/^nume$/i), { target: { value: 'Popescu' } })
    fireEvent.change(screen.getByLabelText(/prenume/i), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText(/telefon/i), { target: { value: '060000000' } })
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/admin/reservations',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(screen.queryByText(/Exista deja o rezervare/i)).not.toBeInTheDocument()
    expect(getReservations()).toEqual([
      expect.objectContaining({ id: 'backend-created', email: 'ana@example.com' }),
    ])
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

  it('lets admin create bookings on multiple dates and skips occupied dates', async () => {
    const fetchMock = mockAdminReservationApi()
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

    await waitFor(() => {
      expect(screen.getByText(/Created 2 bookings/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Skipped 1 occupied date/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations',
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-06-02', startTime: '13:00', endTime: '15:00' }),
        expect.objectContaining({ date: '2026-06-04', startTime: '13:00', endTime: '15:00' }),
      ]),
    )
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toHaveLength(2)
  })

  it('copies an existing admin booking into new bookings on multiple dates', async () => {
    const fetchMock = mockAdminReservationApi()
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

    await waitFor(() => {
      expect(screen.getByText(/Created 2 bookings/i)).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations',
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
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

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function mockAdminReservationApi() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/admin/reservations') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))

      if (body.date === '2026-06-03') {
        return jsonResponse({ message: 'Selected room is already reserved.' }, 422)
      }

      return jsonResponse({
        data: {
          id: `${body.date}-${body.start_time}`,
          room_id: body.room_id,
          date: body.date,
          start_time: body.start_time,
          end_time: body.end_time,
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone,
          status: body.status,
          notes: body.notes,
          created_at: '2026-06-05T12:00:00.000000Z',
        },
      }, 201)
    }

    return jsonResponse({ message: 'Unexpected API request' }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}
