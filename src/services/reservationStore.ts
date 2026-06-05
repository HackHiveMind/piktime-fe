import type { Reservation, ReservationStatus, RoomBlock } from '../domain/types'

const STORAGE_KEY = 'pictime-ihub-reservations'
const BLOCKS_STORAGE_KEY = 'pictime-ihub-room-blocks'

export function getReservations(): Reservation[] {
  const rawReservations = localStorage.getItem(STORAGE_KEY)

  if (!rawReservations) {
    return []
  }

  try {
    const parsed = JSON.parse(rawReservations)
    return Array.isArray(parsed) ? parsed.map(normalizeStoredReservation) : []
  } catch {
    return []
  }
}

export function saveReservations(reservations: Reservation[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations))
}

export function upsertReservation(reservation: Reservation): Reservation[] {
  const reservations = getReservations()
  const existingIndex = reservations.findIndex((item) => item.id === reservation.id)

  if (existingIndex === -1) {
    const nextReservations = [reservation, ...reservations]
    saveReservations(nextReservations)
    return nextReservations
  }

  const nextReservations = reservations.map((item) =>
    item.id === reservation.id ? reservation : item,
  )
  saveReservations(nextReservations)
  return nextReservations
}

export function deleteReservation(reservationId: string): Reservation[] {
  const nextReservations = getReservations().filter(
    (reservation) => reservation.id !== reservationId,
  )
  saveReservations(nextReservations)
  return nextReservations
}

export function getRoomBlocks(): RoomBlock[] {
  const rawBlocks = localStorage.getItem(BLOCKS_STORAGE_KEY)

  if (!rawBlocks) {
    return []
  }

  try {
    const parsed = JSON.parse(rawBlocks)
    return Array.isArray(parsed) ? parsed.map(normalizeStoredRoomBlock) : []
  } catch {
    return []
  }
}

export function saveRoomBlocks(blocks: RoomBlock[]): void {
  localStorage.setItem(BLOCKS_STORAGE_KEY, JSON.stringify(blocks))
}

export function upsertRoomBlock(block: RoomBlock): RoomBlock[] {
  const blocks = getRoomBlocks()
  const existingIndex = blocks.findIndex((item) => item.id === block.id)

  if (existingIndex === -1) {
    const nextBlocks = [block, ...blocks]
    saveRoomBlocks(nextBlocks)
    return nextBlocks
  }

  const nextBlocks = blocks.map((item) => (item.id === block.id ? block : item))
  saveRoomBlocks(nextBlocks)
  return nextBlocks
}

export function deleteRoomBlock(blockId: string): RoomBlock[] {
  const nextBlocks = getRoomBlocks().filter((block) => block.id !== blockId)
  saveRoomBlocks(nextBlocks)
  return nextBlocks
}

function normalizeStoredReservation(reservation: Reservation): Reservation {
  return {
    ...reservation,
    status: getStoredStatus(reservation.status),
    notes: reservation.notes ?? '',
  }
}

function getStoredStatus(status: ReservationStatus | undefined): ReservationStatus {
  return status && ['confirmed', 'pending', 'cancelled', 'no-show'].includes(status)
    ? status
    : 'confirmed'
}

function normalizeStoredRoomBlock(block: RoomBlock): RoomBlock {
  return {
    ...block,
    notes: block.notes ?? '',
  }
}
