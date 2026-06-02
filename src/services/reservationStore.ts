import type { Reservation, ReservationStatus } from '../domain/types'

const STORAGE_KEY = 'pictime-ihub-reservations'

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
