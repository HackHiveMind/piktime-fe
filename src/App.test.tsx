// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ADMIN_API_TOKEN_STORAGE_KEY } from './services/bookingApi'
import { getReservations, saveReservations, saveRoomBlocks } from './services/reservationStore'
import type { Reservation, RoomBlock } from './domain/types'

describe('app routes', () => {
  const currentDate = new Date().toISOString().slice(0, 10)

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  const switchToChisinau = () => {
    fireEvent.click(screen.getByRole('button', { name: /current business/i }))
    fireEvent.click(screen.getByRole('button', { name: /iHUB Chisinau/i }))
  }

  const adminEntry = () => {
    sessionStorage.setItem(ADMIN_API_TOKEN_STORAGE_KEY, 'admin-token-123')

    return '/admin'
  }

  it('renders the public booking interface', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /rezerva o sala/i })).toBeInTheDocument()
    expect(screen.getAllByText('iMEET Room').length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /09:00Liber/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^nume$/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /green conference room/i })).toBeInTheDocument()
  })

  it('shows all public room cards with conference rooms first', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    const roomButtons = screen
      .getAllByRole('button')
      .filter((button) => button.textContent?.includes('Room'))
      .map((button) => button.textContent ?? '')

    expect(roomButtons[0]).toContain('Green Conference Room')
    expect(roomButtons[1]).toContain('Yellow Conference Room')
  })

  it('redirects to the room booking page with slots and the full form after selecting a public room card', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /iMEET Room/i }))

    expect(await screen.findByRole('heading', { level: 1, name: /iMEET Room/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /toate salile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /09:00Liber/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/^nume$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/prenume/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/telefon/i)).toBeInTheDocument()
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
      <MemoryRouter initialEntries={['/rooms/imeet?date=2026-06-01']}>
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
      <MemoryRouter initialEntries={['/rooms/imeet?date=2026-06-01']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /09:00Liber/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirma rezervarea/i }))

    expect(screen.getByText('Completeaza numele.')).toBeInTheDocument()
  })

  it('marks user slots blocked by admin room blocks as unavailable', async () => {
    saveRoomBlocks([
      roomBlock({
        roomId: 'imeet',
        startTime: '13:00',
        endTime: '15:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={['/rooms/imeet?date=2026-06-16']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('button', { name: /13:00Blocat/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /14:30Blocat/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /15:00Liber/i })).not.toBeDisabled()
  })

  it('renders admin calendar with existing reservation details', () => {
    saveReservations([
      reservation({
        firstName: 'Ana',
        lastName: 'Popescu',
        roomId: 'imeet',
        date: currentDate,
        startTime: '09:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

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
              date: currentDate,
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
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

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

  it('keeps the admin calendar focused on today after loading older backend reservations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            {
              id: 'old-backend-reservation',
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
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(getReservations()).toEqual([
        expect.objectContaining({
          id: 'old-backend-reservation',
        }),
      ])
    })
    expect(screen.getByLabelText(/calendar date/i)).toHaveValue(currentDate)
  })

  it('deletes admin reservations from the backend before removing them locally', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/rooms') && !init?.method) {
        return jsonResponse({
          data: [
            apiRoom({ id: 'imeet', name: 'iMEET Room', business_id: 'chisinau', location: 'iHUB Chisinau' }),
          ],
        })
      }

      if (url.endsWith('/api/admin/reservations') && !init?.method) {
        return jsonResponse({
          data: [
            {
              id: 'backend-reservation',
              room_id: 'imeet',
              date: currentDate,
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
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

    await screen.findByRole('button', { name: /Maria Ionescu/i })
    fireEvent.click(screen.getByRole('button', { name: /Maria Ionescu/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete booking/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/admin/reservations/backend-reservation',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({ Accept: 'application/json' }),
        }),
      )
    })
    expect(getReservations()).toEqual([])
    expect(screen.getByText(/Booking removed/i)).toBeInTheDocument()
  })

  it('lets the backend decide when a stale local admin reservation looks conflicting', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/reservations') && !init?.method) {
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
        roomId: 'loft',
        date: '2026-06-01',
        startTime: '09:00',
        endTime: '10:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
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
    expect(getReservations()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'backend-created', email: 'ana@example.com' }),
      expect.objectContaining({ id: 'stale-local', roomId: 'loft' }),
    ]))
  })

  it('renders Picktime-like admin controls for views, search, filters, and status', () => {
    saveReservations([
      reservation({
        firstName: 'Ana',
        lastName: 'Popescu',
        roomId: 'imeet',
        date: currentDate,
        startTime: '09:00',
        status: 'pending',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
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

  it('opens the business switcher and lets admin add a room resource', async () => {
    vi.stubGlobal('fetch', mockAdminRoomsApi())

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /current business/i }))

    expect(screen.getByRole('button', { name: /iHUB Chisinau/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^iHUB Yellow$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iHUB - WFP Conference/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iHUB Yellow Conference/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add room/i }))
    fireEvent.change(screen.getByLabelText(/room name/i), {
      target: { value: 'Podcast Studio' },
    })
    fireEvent.change(screen.getByLabelText(/capacity/i), {
      target: { value: '4' },
    })
    fireEvent.change(screen.getByLabelText(/^business$/i), {
      target: { value: 'chisinau' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save room$/i }))

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^resource$/i })).toHaveTextContent(/Podcast Studio/)
    })
    expect(screen.getByText(/Book Podcast Studio/i)).toBeInTheDocument()
  })

  it('lets admin assign rooms to each business from the rooms section', async () => {
    vi.stubGlobal('fetch', mockAdminRoomsApi())

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /current business/i }))
    fireEvent.click(screen.getByRole('button', { name: /iHUB Chisinau/i }))
    fireEvent.click(screen.getByRole('button', { name: /rooms/i }))
    fireEvent.change(screen.getByLabelText(/business for iMEET Room/i), {
      target: { value: 'yellow' },
    })

    await waitFor(() => {
      expect(screen.getByText(/Room moved/i)).toBeInTheDocument()
    })
    expect(screen.queryByLabelText(/business for iMEET Room/i)).not.toBeInTheDocument()
  })

  it('keeps room business assignments after the admin page reloads', async () => {
    vi.stubGlobal('fetch', mockAdminRoomsApi())

    const { unmount } = render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    switchToChisinau()
    fireEvent.click(screen.getByRole('button', { name: /rooms/i }))
    fireEvent.change(screen.getByLabelText(/business for iMEET Room/i), {
      target: { value: 'yellow' },
    })
    await waitFor(() => {
      expect(screen.queryByLabelText(/business for iMEET Room/i)).not.toBeInTheDocument()
    })

    unmount()
    cleanup()

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /current business/i }))
    fireEvent.click(screen.getByRole('button', { name: /^iHUB Yellow$/i }))
    fireEvent.click(screen.getByRole('button', { name: /rooms/i }))

    expect(screen.getByLabelText(/business for iMEET Room/i)).toHaveValue('yellow')
  })

  it('filters room resources when admin switches business', () => {
    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText(/Book iMEET Room/i)).toBeInTheDocument()
    expect(screen.queryByText(/Book Yellow Conference Room/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /current business/i }))
    fireEvent.click(screen.getByRole('button', { name: /^iHUB Yellow$/i }))

    expect(screen.queryByRole('button', { name: /iHUB - WFP Conference/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iHUB Yellow Conference/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Book Yellow Conference Room/i)).toBeInTheDocument()
    expect(screen.queryByText(/Book iMEET Room/i)).not.toBeInTheDocument()
  })

  it('renders the Picktime-style daily resource grid by default', () => {
    saveReservations([
      reservation({
        firstName: 'Camelia',
        lastName: '',
        roomId: 'yellow-conference',
        date: currentDate,
        startTime: '11:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: /^daily$/i })).toHaveClass('active')
    expect(screen.getByText(/Book iMEET Room/i)).toBeInTheDocument()
    expect(screen.getByText('8am')).toBeInTheDocument()
    expect(screen.getByText('8:30am')).toBeInTheDocument()
    expect(screen.queryByText(/Camelia/)).not.toBeInTheDocument()
  })

  it('lets admin drag a monthly booking to another day and saves it to the backend', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/reservations') && !init?.method) {
        return jsonResponse({ message: 'Temporary load failure' }, 500)
      }

      if (url.endsWith('/api/admin/reservations/reservation-12') && init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))

        return jsonResponse({
          data: {
            id: 'reservation-12',
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
        })
      }

      return jsonResponse({ data: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    saveReservations([
      reservation({
        id: 'reservation-12',
        roomId: 'imeet',
        date: '2026-06-16',
        startTime: '10:30',
        endTime: '11:00',
        firstName: 'Buga',
        lastName: 'Alex',
        email: 'abuga454@gmail.com',
        phone: '1234567890',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/calendar date/i), { target: { value: '2026-06-16' } })
    fireEvent.click(screen.getByRole('button', { name: /^monthly$/i }))
    const booking = (await screen.findByText(/Buga Alex/i)).closest('button')
    const targetDay = screen.getByLabelText(/Move booking to 2026-06-17/i)

    expect(booking).not.toBeNull()

    fireEvent.dragStart(booking as HTMLButtonElement, {
      dataTransfer: createDataTransfer(),
    })
    fireEvent.drop(targetDay, {
      dataTransfer: createDataTransfer({ 'text/plain': 'reservation-12' }),
    })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/admin/reservations/reservation-12',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"date":"2026-06-17"'),
        }),
      )
    })
    expect(await screen.findByText(/Booking moved/i)).toBeInTheDocument()
  })

  it('opens a new booking modal for a dragged daily time range', () => {
    saveReservations([
      reservation({
        id: 'anchor',
        roomId: 'loft',
        date: currentDate,
        startTime: '09:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

    fireEvent.mouseDown(
      screen.getByLabelText(`Select iMEET Room ${currentDate} 13:00`),
    )
    fireEvent.mouseEnter(
      screen.getByLabelText(`Select iMEET Room ${currentDate} 15:00`),
    )

    expect(screen.getByText('1pm - 3pm')).toBeInTheDocument()

    fireEvent.mouseUp(
      screen.getByLabelText(`Select iMEET Room ${currentDate} 15:00`),
    )

    expect(screen.getByRole('heading', { name: /new booking/i })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${currentDate}, 13:00 - 15:00`, 'i'))).toBeInTheDocument()
  })

  it('opens a thirty-minute booking when only one daily grid square is selected', () => {
    saveReservations([
      reservation({
        id: 'anchor',
        roomId: 'loft',
        date: currentDate,
        startTime: '09:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

    fireEvent.mouseDown(
      screen.getByLabelText(`Select iMEET Room ${currentDate} 13:00`),
    )
    fireEvent.mouseUp(
      screen.getByLabelText(`Select iMEET Room ${currentDate} 13:00`),
    )

    expect(screen.getByRole('heading', { name: /new booking/i })).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${currentDate}, 13:00 - 13:30`, 'i'))).toBeInTheDocument()
  })

  it('lets admin create and remove indefinite room blocks', () => {
    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

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
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

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
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json', 'Content-Type': 'application/json' }),
        method: 'POST',
      }),
    )
    const postedDates = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)).date)

    expect(postedDates).toEqual(['2026-06-02', '2026-06-04'])
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-06-02', startTime: '13:00', endTime: '15:00' }),
        expect.objectContaining({ date: '2026-06-04', startTime: '13:00', endTime: '15:00' }),
      ]),
    )
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toHaveLength(2)
  })

  it('starts admin booking requests for multiple free dates in parallel', async () => {
    const pendingPosts: Array<() => void> = []
    const postedDates: string[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/api/admin/reservations') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        postedDates.push(body.date)

        return new Promise<Response>((resolve) => {
          pendingPosts.push(() =>
            resolve(
              jsonResponse({
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
              }, 201),
            ),
          )
        })
      }

      return jsonResponse({ message: 'Unexpected API request' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

    fireEvent.click(screen.getByRole('button', { name: /new booking/i }))
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: '2026-06-20' } })
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '13:00' } })
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '15:00' } })
    fireEvent.change(screen.getByLabelText(/^additional date$/i), {
      target: { value: '2026-06-21' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add date/i }))
    fireEvent.change(screen.getByLabelText(/^nume$/i), { target: { value: 'Marin' } })
    fireEvent.change(screen.getByLabelText(/prenume/i), { target: { value: 'Ion' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'ion@example.com' } })
    fireEvent.change(screen.getByLabelText(/telefon/i), { target: { value: '060111222' } })
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    await waitFor(() => {
      expect(postedDates).toEqual(['2026-06-20', '2026-06-21'])
    })

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /new booking/i })).not.toBeInTheDocument()
    })
    expect(getReservations().filter((item) => item.email === 'ion@example.com')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-06-20', startTime: '13:00', endTime: '15:00' }),
        expect.objectContaining({ date: '2026-06-21', startTime: '13:00', endTime: '15:00' }),
      ]),
    )

    pendingPosts.forEach((resolvePost) => resolvePost())

    await waitFor(() => {
      expect(screen.getByText(/Created 2 bookings/i)).toBeInTheDocument()
    })
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
        date: currentDate,
        startTime: '11:00',
        endTime: '12:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

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
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: 'application/json', 'Content-Type': 'application/json' }),
        method: 'POST',
      }),
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(getReservations().filter((item) => item.email === 'ana@example.com')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-06-08', roomId: 'imeet', startTime: '11:00' }),
        expect.objectContaining({ date: '2026-06-09', roomId: 'imeet', startTime: '11:00' }),
      ]),
    )
    expect(getReservations().filter((item) => item.email === 'ana@example.com')).toHaveLength(3)
  })

  it('skips the original occupied date when copying an admin booking', async () => {
    const fetchMock = mockAdminReservationApi()
    saveReservations([
      reservation({
        id: 'copy-source',
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@example.com',
        roomId: 'imeet',
        date: currentDate,
        startTime: '11:00',
        endTime: '12:00',
      }),
    ])

    render(
      <MemoryRouter initialEntries={[adminEntry()]}>
        <App />
      </MemoryRouter>,
    )
    switchToChisinau()

    fireEvent.click(screen.getByRole('button', { name: /Ana Popescu/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy booking/i }))
    fireEvent.change(screen.getByLabelText(/^additional date$/i), {
      target: { value: '2026-06-09' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add date/i }))
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }))

    await waitFor(() => {
      expect(screen.getByText(/Created 1 booking/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Skipped 1 occupied date/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations',
      expect.objectContaining({
        body: expect.stringContaining('"date":"2026-06-09"'),
        method: 'POST',
      }),
    )
    expect(fetchMock).not.toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations',
      expect.objectContaining({
        body: expect.stringContaining(`"date":"${currentDate}"`),
        method: 'POST',
      }),
    )
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

function createDataTransfer(initialData: Record<string, string> = {}) {
  const data = new Map(Object.entries(initialData))

  return {
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    clearData: (type?: string) => {
      if (type) {
        data.delete(type)
      } else {
        data.clear()
      }
    },
    effectAllowed: 'move',
    dropEffect: 'move',
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

function mockAdminRoomsApi() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/admin/rooms') && !init?.method) {
      return jsonResponse({
        data: [
          apiRoom({ id: 'imeet', name: 'iMEET Room', business_id: 'chisinau', location: 'iHUB Chisinau' }),
          apiRoom({
            id: 'yellow-conference',
            name: 'Yellow Conference Room',
            capacity: 30,
            business_id: 'yellow',
            location: 'iHUB Yellow',
          }),
        ],
      })
    }

    if (url.endsWith('/api/admin/rooms') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))

      return jsonResponse({
        data: apiRoom({
          id: 'podcast-studio',
          name: body.name,
          capacity: body.capacity,
          business_id: body.business_id,
          location: body.location,
          amenities: body.amenities,
          accent: body.accent,
        }),
      }, 201)
    }

    if (url.includes('/api/admin/rooms/') && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body))
      const id = url.split('/').pop() ?? 'imeet'

      return jsonResponse({
        data: apiRoom({
          id,
          name: body.name,
          capacity: body.capacity,
          business_id: body.business_id,
          location: body.location,
          amenities: body.amenities,
          accent: body.accent,
        }),
      })
    }

    if (url.endsWith('/api/admin/reservations') && !init?.method) {
      return jsonResponse({ data: [] })
    }

    return jsonResponse({ message: 'Unexpected API request' }, 404)
  })
}

function apiRoom(overrides: Partial<{
  id: string
  name: string
  capacity: number
  business_id: string
  location: string
  amenities: string[]
  accent: string
}> = {}) {
  return {
    id: 'imeet',
    name: 'iMEET Room',
    capacity: 8,
    business_id: 'chisinau',
    location: 'iHUB Chisinau',
    amenities: [],
    accent: '#f7de05',
    ...overrides,
  }
}
