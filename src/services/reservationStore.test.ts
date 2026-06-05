// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteRoomBlock,
  deleteReservation,
  getRoomBlocks,
  getReservations,
  saveRoomBlocks,
  saveReservations,
  upsertRoomBlock,
  upsertReservation,
} from './reservationStore'
import type { Reservation, RoomBlock } from '../domain/types'

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

  it('hydrates older reservations with default status and notes', () => {
    localStorage.setItem(
      'pictime-ihub-reservations',
      JSON.stringify([
        {
          id: 'r-legacy',
          roomId: 'room-a',
          date: '2026-06-01',
          startTime: '09:00',
          endTime: '10:00',
          firstName: 'Legacy',
          lastName: 'Guest',
          email: 'legacy@example.com',
          phone: '060000000',
          createdAt: '2026-05-31T12:00:00.000Z',
        },
      ]),
    )

    expect(getReservations()[0]).toMatchObject({
      id: 'r-legacy',
      status: 'confirmed',
      notes: '',
    })
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

  it('saves and loads room blocks from localStorage', () => {
    saveRoomBlocks([roomBlock({ id: 'b-1' })])

    expect(getRoomBlocks()).toEqual([roomBlock({ id: 'b-1' })])
  })

  it('upserts and deletes room blocks by id', () => {
    saveRoomBlocks([roomBlock({ id: 'b-1', startTime: '09:00' })])

    upsertRoomBlock(roomBlock({ id: 'b-2', startTime: '13:00' }))
    upsertRoomBlock(roomBlock({ id: 'b-1', startTime: '10:00' }))
    deleteRoomBlock('b-2')

    expect(getRoomBlocks()).toEqual([roomBlock({ id: 'b-1', startTime: '10:00' })])
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

function roomBlock(overrides: Partial<RoomBlock>): RoomBlock {
  return {
    id: 'block-default',
    roomId: 'room-a',
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
    createdAt: '2026-05-31T12:00:00.000Z',
    ...overrides,
  }
}
