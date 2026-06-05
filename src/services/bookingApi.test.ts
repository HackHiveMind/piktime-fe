import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPublicReservation,
  fetchRoomAvailability,
  fetchRooms,
  mapApiReservation,
} from './bookingApi'

describe('booking api', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
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
      { id: 'imeet', name: 'iMEET Room', capacity: 8 },
    ])
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:8000/api/rooms')
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
        headers: { 'Content-Type': 'application/json' },
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

function apiReservation() {
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
    status: 'confirmed' as const,
    notes: '',
    created_at: '2026-06-05T12:00:00.000000Z',
  }
}
