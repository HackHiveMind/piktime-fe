import { describe, expect, it } from 'vitest'
import {
  BOOKING_END_HOUR,
  BOOKING_START_HOUR,
  createReservation,
  findConflictingReservation,
  getTimeSlots,
  updateReservation,
} from './booking'
import type { Reservation } from './types'

describe('booking domain', () => {
  it('generates one-hour slots from 09:00 until 21:00', () => {
    const slots = getTimeSlots()

    expect(BOOKING_START_HOUR).toBe(9)
    expect(BOOKING_END_HOUR).toBe(21)
    expect(slots).toHaveLength(12)
    expect(slots[0]).toEqual({
      start: '09:00',
      end: '10:00',
      label: '09:00 - 10:00',
    })
    expect(slots.at(-1)).toEqual({
      start: '20:00',
      end: '21:00',
      label: '20:00 - 21:00',
    })
  })

  it('finds a conflict only when room, date, and time match', () => {
    const reservations: Reservation[] = [
      reservation({ id: 'r-1', roomId: 'room-a', date: '2026-06-01', startTime: '09:00' }),
      reservation({ id: 'r-2', roomId: 'room-b', date: '2026-06-01', startTime: '09:00' }),
    ]

    expect(
      findConflictingReservation(reservations, {
        roomId: 'room-a',
        date: '2026-06-01',
        startTime: '09:00',
      })?.id,
    ).toBe('r-1')

    expect(
      findConflictingReservation(reservations, {
        roomId: 'room-a',
        date: '2026-06-02',
        startTime: '09:00',
      }),
    ).toBeUndefined()
  })

  it('ignores the edited reservation when checking conflicts', () => {
    const reservations: Reservation[] = [
      reservation({ id: 'r-1', roomId: 'room-a', date: '2026-06-01', startTime: '09:00' }),
    ]

    expect(
      findConflictingReservation(
        reservations,
        {
          roomId: 'room-a',
          date: '2026-06-01',
          startTime: '09:00',
        },
        'r-1',
      ),
    ).toBeUndefined()
  })

  it('creates a reservation with normalized contact fields and matching end time', () => {
    const created = createReservation({
      roomId: 'room-a',
      date: '2026-06-01',
      startTime: '10:00',
      firstName: ' Ana ',
      lastName: ' Popescu ',
      email: ' ANA@EXAMPLE.COM ',
      phone: ' 069123456 ',
    })

    expect(created).toMatchObject({
      roomId: 'room-a',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '11:00',
      firstName: 'Ana',
      lastName: 'Popescu',
      email: 'ana@example.com',
      phone: '069123456',
    })
    expect(created.id).toMatch(/^reservation-/)
    expect(created.createdAt).toMatch(/T/)
  })

  it('updates a reservation without changing id or createdAt', () => {
    const existing = reservation({
      id: 'r-1',
      roomId: 'room-a',
      date: '2026-06-01',
      startTime: '09:00',
      createdAt: '2026-05-31T12:00:00.000Z',
    })

    const updated = updateReservation(existing, {
      roomId: 'room-b',
      date: '2026-06-02',
      startTime: '11:00',
      firstName: 'Ion',
      lastName: 'Rusu',
      email: 'ion@example.com',
      phone: '060000000',
    })

    expect(updated).toMatchObject({
      id: 'r-1',
      createdAt: '2026-05-31T12:00:00.000Z',
      roomId: 'room-b',
      date: '2026-06-02',
      startTime: '11:00',
      endTime: '12:00',
      firstName: 'Ion',
    })
  })
})

function reservation(overrides: Partial<Reservation>): Reservation {
  return {
    id: 'reservation-default',
    roomId: 'room-a',
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
