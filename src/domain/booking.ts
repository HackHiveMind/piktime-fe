import type { Reservation, ReservationFormData, TimeSlot } from './types'

export const BOOKING_START_HOUR = 9
export const BOOKING_END_HOUR = 21

export function getTimeSlots(): TimeSlot[] {
  return Array.from({ length: BOOKING_END_HOUR - BOOKING_START_HOUR }, (_, index) => {
    const startHour = BOOKING_START_HOUR + index
    const endHour = startHour + 1
    const start = formatHour(startHour)
    const end = formatHour(endHour)

    return {
      start,
      end,
      label: `${start} - ${end}`,
    }
  })
}

export function findConflictingReservation(
  reservations: Reservation[],
  candidate: Pick<ReservationFormData, 'roomId' | 'date' | 'startTime'>,
  ignoreReservationId?: string,
): Reservation | undefined {
  return reservations.find(
    (reservation) =>
      reservation.id !== ignoreReservationId &&
      reservation.roomId === candidate.roomId &&
      reservation.date === candidate.date &&
      reservation.startTime === candidate.startTime,
  )
}

export function createReservation(formData: ReservationFormData): Reservation {
  return {
    ...normalizeFormData(formData),
    id: `reservation-${crypto.randomUUID()}`,
    endTime: getEndTime(formData.startTime),
    createdAt: new Date().toISOString(),
  }
}

export function updateReservation(
  reservation: Reservation,
  formData: ReservationFormData,
): Reservation {
  return {
    ...reservation,
    ...normalizeFormData(formData),
    endTime: getEndTime(formData.startTime),
  }
}

export function getEndTime(startTime: string): string {
  const hour = Number(startTime.slice(0, 2))
  return formatHour(hour + 1)
}

export function formatDisplayDate(date: string): string {
  return new Intl.DateTimeFormat('ro-MD', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}

function normalizeFormData(formData: ReservationFormData): ReservationFormData {
  return {
    roomId: formData.roomId,
    date: formData.date,
    startTime: formData.startTime,
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim().toLowerCase(),
    phone: formData.phone.trim(),
  }
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}
