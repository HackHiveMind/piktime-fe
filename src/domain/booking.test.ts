import { describe, expect, it } from 'vitest'
import {
  BOOKING_END_HOUR,
  BOOKING_START_HOUR,
  createReservation,
  filterReservations,
  findConflictingReservation,
  getCalendarDates,
  getReservationStats,
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

  it('finds a conflict only when room, date, and time overlap', () => {
    const reservations: Reservation[] = [
      reservation({
        id: 'r-1',
        roomId: 'room-a',
        date: '2026-06-01',
        startTime: '13:00',
        endTime: '15:00',
      }),
      reservation({ id: 'r-2', roomId: 'room-b', date: '2026-06-01', startTime: '09:00' }),
    ]

    expect(
      findConflictingReservation(reservations, {
        roomId: 'room-a',
        date: '2026-06-01',
        startTime: '14:00',
        endTime: '15:00',
      })?.id,
    ).toBe('r-1')

    expect(
      findConflictingReservation(reservations, {
        roomId: 'room-a',
        date: '2026-06-02',
        startTime: '14:00',
        endTime: '15:00',
      }),
    ).toBeUndefined()
  })

  it('allows back-to-back reservations without treating them as conflicts', () => {
    const reservations: Reservation[] = [
      reservation({
        id: 'r-1',
        roomId: 'room-a',
        date: '2026-06-01',
        startTime: '13:00',
        endTime: '15:00',
      }),
    ]

    expect(
      findConflictingReservation(reservations, {
        roomId: 'room-a',
        date: '2026-06-01',
        startTime: '15:00',
        endTime: '16:00',
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
      status: 'pending',
      notes: '  Needs projector  ',
      endTime: '15:00',
    })

    expect(created).toMatchObject({
      roomId: 'room-a',
      date: '2026-06-01',
      startTime: '10:00',
      endTime: '15:00',
      firstName: 'Ana',
      lastName: 'Popescu',
      email: 'ana@example.com',
      phone: '069123456',
      status: 'pending',
      notes: 'Needs projector',
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
      status: 'cancelled',
      notes: 'Client moved meeting',
      endTime: '15:00',
    })

    expect(updated).toMatchObject({
      id: 'r-1',
      createdAt: '2026-05-31T12:00:00.000Z',
      roomId: 'room-b',
      date: '2026-06-02',
      startTime: '11:00',
      endTime: '15:00',
      firstName: 'Ion',
      status: 'cancelled',
      notes: 'Client moved meeting',
    })
  })

  it('defaults new reservations to confirmed when status is not selected', () => {
    const created = createReservation({
      roomId: 'room-a',
      date: '2026-06-01',
      startTime: '10:00',
      firstName: 'Ana',
      lastName: 'Popescu',
      email: 'ana@example.com',
      phone: '069123456',
    })

    expect(created.status).toBe('confirmed')
    expect(created.notes).toBe('')
  })

  it('builds calendar dates for day, week, month, and agenda views', () => {
    expect(getCalendarDates('2026-05-31', 'day')).toEqual(['2026-05-31'])
    expect(getCalendarDates('2026-05-31', 'week')).toEqual([
      '2026-05-25',
      '2026-05-26',
      '2026-05-27',
      '2026-05-28',
      '2026-05-29',
      '2026-05-30',
      '2026-05-31',
    ])
    expect(getCalendarDates('2026-05-31', 'month')[0]).toBe('2026-05-01')
    expect(getCalendarDates('2026-05-31', 'month').at(-1)).toBe('2026-05-31')
    expect(getCalendarDates('2026-05-31', 'agenda')).toHaveLength(14)
  })

  it('filters reservations by room, status, search, and visible dates', () => {
    const reservations: Reservation[] = [
      reservation({
        id: 'r-1',
        roomId: 'room-a',
        date: '2026-06-01',
        firstName: 'Ana',
        lastName: 'Popescu',
        email: 'ana@example.com',
        phone: '060111111',
        status: 'confirmed',
      }),
      reservation({
        id: 'r-2',
        roomId: 'room-b',
        date: '2026-06-02',
        firstName: 'Ion',
        lastName: 'Rusu',
        email: 'ion@example.com',
        phone: '060222222',
        status: 'pending',
      }),
    ]

    const filtered = filterReservations(reservations, {
      roomId: 'room-a',
      status: 'confirmed',
      search: 'ana',
      dates: ['2026-06-01'],
    })

    expect(filtered.map((item) => item.id)).toEqual(['r-1'])
  })

  it('summarizes reservations for admin dashboard metrics', () => {
    const stats = getReservationStats(
      [
        reservation({ id: 'r-1', date: '2026-06-01', status: 'confirmed' }),
        reservation({ id: 'r-2', date: '2026-06-01', status: 'pending' }),
        reservation({ id: 'r-3', date: '2026-06-02', status: 'cancelled' }),
      ],
      '2026-06-01',
    )

    expect(stats).toEqual({
      today: 2,
      upcoming: 2,
      pending: 1,
      cancelled: 1,
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
    status: 'confirmed',
    notes: '',
    createdAt: '2026-05-31T12:00:00.000Z',
    ...overrides,
  }
}
