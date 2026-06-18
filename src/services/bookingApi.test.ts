// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAdminReservation,
  createAdminRoom,
  deleteAdminReservation,
  fetchAdminRooms,
  createPublicReservation,
  fetchAdminReservations,
  fetchRoomAvailability,
  fetchRooms,
  initAdminApiTokenFromUrl,
  mapApiReservation,
  updateAdminReservation,
  updateAdminRoom,
} from './bookingApi'
import type { ReservationStatus } from '../domain/types'

describe('booking api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('loads rooms from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [{ id: 'imeet', name: 'iMEET Room', capacity: 8 }],
        }),
      ),
    )

    await expect(fetchRooms()).resolves.toEqual([
      {
        id: 'imeet',
        name: 'iMEET Room',
        capacity: 8,
        businessId: undefined,
        location: '',
        amenities: [],
        accent: '#f7de05',
        imageUrl: '',
      },
    ])
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/api/rooms', {
      headers: { Accept: 'application/json' },
    })
  })

  it('loads admin rooms with business metadata from the backend', async () => {
    sessionStorage.setItem('ihub-admin-api-token', 'admin-token-123')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            {
              id: 'imeet',
              name: 'iMEET Room',
              capacity: 8,
              business_id: 'chisinau',
              location: 'iHUB Chisinau',
              amenities: ['TV'],
              accent: '#74bd45',
              image_url: 'https://example.test/imeet.jpg',
            },
          ],
        }),
      ),
    )

    await expect(fetchAdminRooms()).resolves.toEqual([
      {
        id: 'imeet',
        name: 'iMEET Room',
        capacity: 8,
        businessId: 'chisinau',
        location: 'iHUB Chisinau',
        amenities: ['TV'],
        accent: '#74bd45',
        imageUrl: 'https://example.test/imeet.jpg',
      },
    ])
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/api/admin/rooms', {
      headers: { Accept: 'application/json', Authorization: 'Bearer admin-token-123' },
    })
  })

  it('stores the admin login token from the redirect URL and removes it from the address bar', () => {
    window.history.replaceState(null, '', '/admin?admin_token=admin-token-123&view=calendar')

    initAdminApiTokenFromUrl()

    expect(sessionStorage.getItem('ihub-admin-api-token')).toBe('admin-token-123')
    expect(window.location.pathname).toBe('/admin')
    expect(window.location.search).toBe('?view=calendar')
  })

  it('creates an admin room through the backend', async () => {
    sessionStorage.setItem('ihub-admin-api-token', 'admin-token-123')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            id: 'podcast-studio',
            name: 'Podcast Studio',
            capacity: 4,
            business_id: 'yellow',
            location: 'iHUB Yellow',
            amenities: [],
            accent: '#f7de05',
            image_url: 'https://example.test/podcast.jpg',
          },
        }, 201),
      ),
    )

    await expect(
      createAdminRoom({
        id: 'podcast-studio',
        name: 'Podcast Studio',
        capacity: 4,
        businessId: 'yellow',
        location: 'iHUB Yellow',
        amenities: [],
        accent: '#f7de05',
        imageUrl: 'https://example.test/podcast.jpg',
      }),
    ).resolves.toMatchObject({ id: 'podcast-studio', businessId: 'yellow' })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/rooms',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer admin-token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Podcast Studio',
          capacity: 4,
          business_id: 'yellow',
          location: 'iHUB Yellow',
          amenities: [],
          accent: '#f7de05',
          image_url: 'https://example.test/podcast.jpg',
        }),
      }),
    )
  })

  it('updates an admin room through the backend', async () => {
    sessionStorage.setItem('ihub-admin-api-token', 'admin-token-123')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            id: 'imeet',
            name: 'iMEET Room',
            capacity: 8,
            business_id: 'yellow',
            location: 'iHUB Yellow',
            amenities: [],
            accent: '#74bd45',
            image_url: 'https://example.test/imeet-new.jpg',
          },
        }),
      ),
    )

    await expect(
      updateAdminRoom({
        id: 'imeet',
        name: 'iMEET Room',
        capacity: 8,
        businessId: 'yellow',
        location: 'iHUB Yellow',
        amenities: [],
        accent: '#74bd45',
        imageUrl: 'https://example.test/imeet-new.jpg',
      }),
    ).resolves.toMatchObject({ id: 'imeet', businessId: 'yellow' })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/rooms/imeet',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'iMEET Room',
          capacity: 8,
          business_id: 'yellow',
          location: 'iHUB Yellow',
          amenities: [],
          accent: '#74bd45',
          image_url: 'https://example.test/imeet-new.jpg',
        }),
      }),
    )
  })

  it('loads room availability from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            room_id: 'imeet',
            date: '2026-06-10',
            slots: [{ start: '09:00', end: '10:00', label: '09:00 - 10:00', available: true }],
          },
        }),
      ),
    )

    await expect(fetchRoomAvailability('imeet', '2026-06-10')).resolves.toEqual({
      roomId: 'imeet',
      date: '2026-06-10',
      slots: [{ start: '09:00', end: '10:00', label: '09:00 - 10:00', available: true }],
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/rooms/imeet/availability?date=2026-06-10',
      { headers: { Accept: 'application/json' } },
    )
  })

  it('creates a public reservation and maps backend fields to frontend fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: apiReservation(),
        }, 201),
      ),
    )

    await expect(
      createPublicReservation({
        roomId: 'imeet',
        date: '2026-06-10',
        startTime: '09:00',
        endTime: '10:00',
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@example.com',
        phone: '+373 600 00 000',
      }),
    ).resolves.toMatchObject({
      id: '12',
      roomId: 'imeet',
      date: '2026-06-10',
      startTime: '09:00',
      endTime: '10:00',
      status: 'confirmed',
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/reservations',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: 'imeet',
          date: '2026-06-10',
          start_time: '09:00',
          first_name: 'Ana',
          last_name: 'Popescu',
          email: 'ana@example.com',
          phone: '+373 600 00 000',
          notes: undefined,
        }),
      }),
    )
  })

  it('creates an admin reservation with custom status and time range', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: apiReservation({
            start_time: '13:00',
            end_time: '15:00',
            status: 'pending',
          }),
        }, 201),
      ),
    )

    await expect(
      createAdminReservation({
        roomId: 'imeet',
        date: '2026-06-10',
        startTime: '13:00',
        endTime: '15:00',
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@example.com',
        phone: '+373 600 00 000',
        status: 'pending',
        notes: 'Admin booking',
      }),
    ).resolves.toMatchObject({
      roomId: 'imeet',
      startTime: '13:00',
      endTime: '15:00',
      status: 'pending',
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: 'imeet',
          date: '2026-06-10',
          start_time: '13:00',
          end_time: '15:00',
          first_name: 'Ana',
          last_name: 'Popescu',
          email: 'ana@example.com',
          phone: '+373 600 00 000',
          status: 'pending',
          notes: 'Admin booking',
        }),
      }),
    )
  })

  it('updates an admin reservation through the backend', async () => {
    sessionStorage.setItem('ihub-admin-api-token', 'admin-token-123')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: apiReservation({
            date: '2026-06-17',
            start_time: '10:30',
            end_time: '11:30',
          }),
        }),
      ),
    )

    await expect(
      updateAdminReservation({
        id: 'reservation-12',
        roomId: 'imeet',
        date: '2026-06-17',
        startTime: '10:30',
        endTime: '11:30',
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@example.com',
        phone: '+373 600 00 000',
        status: 'confirmed',
        notes: '',
        createdAt: '2026-06-05T12:00:00.000000Z',
      }),
    ).resolves.toMatchObject({
      id: '12',
      date: '2026-06-17',
      startTime: '10:30',
      endTime: '11:30',
    })
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations/reservation-12',
      expect.objectContaining({
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer admin-token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_id: 'imeet',
          date: '2026-06-17',
          start_time: '10:30',
          end_time: '11:30',
          first_name: 'Ana',
          last_name: 'Popescu',
          email: 'ana@example.com',
          phone: '+373 600 00 000',
          status: 'confirmed',
          notes: '',
        }),
      }),
    )
  })

  it('loads admin reservations from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: [
            apiReservation({
              first_name: 'Maria',
              last_name: 'Ionescu',
              email: 'maria@example.com',
            }),
          ],
        }),
      ),
    )

    await expect(fetchAdminReservations()).resolves.toEqual([
      expect.objectContaining({
        firstName: 'Maria',
        lastName: 'Ionescu',
        email: 'maria@example.com',
      }),
    ])
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/api/admin/reservations', {
      headers: { Accept: 'application/json' },
    })
  })

  it('deletes an admin reservation through the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(noContentResponse()),
    )

    await expect(deleteAdminReservation('reservation-12')).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/admin/reservations/reservation-12',
      expect.objectContaining({
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('maps api reservations into frontend reservations', () => {
    expect(mapApiReservation(apiReservation())).toEqual({
      id: '12',
      roomId: 'imeet',
      date: '2026-06-10',
      startTime: '09:00',
      endTime: '10:00',
      firstName: 'Ana',
      lastName: 'Popescu',
      email: 'ana@example.com',
      phone: '+373 600 00 000',
      status: 'confirmed',
      notes: '',
      createdAt: '2026-06-05T12:00:00.000000Z',
    })
  })
})

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function noContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.resolve(null),
  } as Response
}

type TestApiReservation = {
  id: string
  room_id: string
  date: string
  start_time: string
  end_time: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: ReservationStatus
  notes: string | null
  created_at: string
}

function apiReservation(overrides: Partial<TestApiReservation> = {}): TestApiReservation {
  return {
    ...baseApiReservation(),
    ...overrides,
  }
}

function baseApiReservation(): TestApiReservation {
  return {
    id: '12',
    room_id: 'imeet',
    date: '2026-06-10',
    start_time: '09:00',
    end_time: '10:00',
    first_name: 'Ana',
    last_name: 'Popescu',
    email: 'ana@example.com',
    phone: '+373 600 00 000',
    status: 'confirmed',
    notes: '',
    created_at: '2026-06-05T12:00:00.000000Z',
  }
}
