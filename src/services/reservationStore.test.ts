// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteReservation,
  getReservations,
  saveReservations,
  upsertReservation,
} from './reservationStore'
import type { Reservation } from '../domain/types'

describe('reservation store', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty list when no reservations exist', () => {
    expect(getReservations()).toEqual([])
  })

  it('saves and loads reservations from localStorage', () => {
    saveReservations([reservation({ id: 'r-1' })])

    expect(getReservations()).toEqual([reservation({ id: 'r-1' })])
  })

  it('upserts a new reservation at the front of the list', () => {
    saveReservations([reservation({ id: 'r-1', firstName: 'Ana' })])

    upsertReservation(reservation({ id: 'r-2', firstName: 'Ion' }))

    expect(getReservations().map((item) => item.id)).toEqual(['r-2', 'r-1'])
  })

  it('updates an existing reservation without duplicating it', () => {
    saveReservations([reservation({ id: 'r-1', firstName: 'Ana' })])

    upsertReservation(reservation({ id: 'r-1', firstName: 'Updated' }))

    expect(getReservations()).toHaveLength(1)
    expect(getReservations()[0].firstName).toBe('Updated')
  })

  it('deletes a reservation by id', () => {
    saveReservations([reservation({ id: 'r-1' }), reservation({ id: 'r-2' })])

    deleteReservation('r-1')

    expect(getReservations().map((item) => item.id)).toEqual(['r-2'])
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
