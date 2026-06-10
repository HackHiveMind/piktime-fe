import type {
  CalendarView,
  Reservation,
  ReservationFormData,
  ReservationStatus,
  RoomBlock,
  RoomBlockFormData,
  TimeSlot,
} from './types'

export const BOOKING_START_HOUR = 9
export const BOOKING_END_HOUR = 21
export const RESERVATION_STATUSES: Array<{
  value: ReservationStatus
  label: string
}> = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no-show', label: 'No-show' },
]

export function getTimeSlots(): TimeSlot[] {
  const startMinutes = BOOKING_START_HOUR * 60
  const endMinutes = BOOKING_END_HOUR * 60
  const slotCount = (endMinutes - startMinutes) / 30

  return Array.from({ length: slotCount }, (_, index) => {
    const start = formatMinutes(startMinutes + index * 30)
    const end = formatMinutes(startMinutes + (index + 1) * 30)

    return {
      start,
      end,
      label: `${start} - ${end}`,
    }
  })
}

export function getPublicBookingSlots(): TimeSlot[] {
  const startMinutes = BOOKING_START_HOUR * 60
  const lastStartMinutes = (BOOKING_END_HOUR - 1) * 60
  const slotCount = ((lastStartMinutes - startMinutes) / 30) + 1

  return Array.from({ length: slotCount }, (_, index) => {
    const start = formatMinutes(startMinutes + index * 30)
    const end = formatMinutes(startMinutes + index * 30 + 60)

    return {
      start,
      end,
      label: `${start} - ${end}`,
    }
  })
}

export function findConflictingReservation(
  reservations: Reservation[],
  candidate: Pick<ReservationFormData, 'roomId' | 'date' | 'startTime' | 'endTime'>,
  ignoreReservationId?: string,
): Reservation | undefined {
  const candidateStart = timeToMinutes(candidate.startTime)
  const candidateEnd = timeToMinutes(candidate.endTime ?? getEndTime(candidate.startTime))

  return reservations.find(
    (reservation) => {
      const reservationStart = timeToMinutes(reservation.startTime)
      const reservationEnd = timeToMinutes(reservation.endTime)

      return (
        reservation.id !== ignoreReservationId &&
        reservation.roomId === candidate.roomId &&
        reservation.date === candidate.date &&
        reservationStart < candidateEnd &&
        candidateStart < reservationEnd
      )
    },
  )
}

export function findConflictingRoomBlock(
  blocks: RoomBlock[],
  candidate: Pick<RoomBlockFormData, 'roomId' | 'startTime' | 'endTime'>,
  ignoreBlockId?: string,
): RoomBlock | undefined {
  const candidateStart = timeToMinutes(candidate.startTime)
  const candidateEnd = timeToMinutes(candidate.endTime)

  return blocks.find((block) => {
    const blockStart = timeToMinutes(block.startTime)
    const blockEnd = timeToMinutes(block.endTime)

    return (
      block.id !== ignoreBlockId &&
      block.roomId === candidate.roomId &&
      blockStart < candidateEnd &&
      candidateStart < blockEnd
    )
  })
}

export function createReservation(formData: ReservationFormData): Reservation {
  return {
    ...normalizeFormData(formData),
    id: `reservation-${crypto.randomUUID()}`,
    endTime: formData.endTime ?? getEndTime(formData.startTime),
    createdAt: new Date().toISOString(),
  }
}

export function createRoomBlock(formData: RoomBlockFormData): RoomBlock {
  return {
    roomId: formData.roomId,
    startTime: formData.startTime,
    endTime: formData.endTime,
    notes: formData.notes?.trim() ?? '',
    id: `block-${crypto.randomUUID()}`,
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
    endTime: formData.endTime ?? getEndTime(formData.startTime),
  }
}

export function getEndTime(startTime: string): string {
  const hour = Number(startTime.slice(0, 2))
  return formatHour(hour + 1)
}

export function getCalendarDates(anchorDate: string, view: CalendarView): string[] {
  if (view === 'day') {
    return [anchorDate]
  }

  if (view === 'month') {
    const date = createLocalDate(anchorDate)
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    return Array.from({ length: daysInMonth }, (_, index) =>
      toDateInputValue(new Date(year, month, index + 1)),
    )
  }

  if (view === 'agenda') {
    return Array.from({ length: 14 }, (_, index) => addDays(anchorDate, index))
  }

  const startDate = startOfWeek(anchorDate)
  return Array.from({ length: 7 }, (_, index) => addDays(startDate, index))
}

export type ReservationFilters = {
  roomId: string
  status: ReservationStatus | 'all'
  search: string
  dates: string[]
}

export function filterReservations(
  reservations: Reservation[],
  filters: ReservationFilters,
): Reservation[] {
  const normalizedSearch = filters.search.trim().toLowerCase()
  const dateSet = new Set(filters.dates)

  return reservations
    .filter((reservation) => filters.roomId === 'all' || reservation.roomId === filters.roomId)
    .filter((reservation) => filters.status === 'all' || reservation.status === filters.status)
    .filter((reservation) => filters.dates.length === 0 || dateSet.has(reservation.date))
    .filter((reservation) => {
      if (!normalizedSearch) {
        return true
      }

      return [
        reservation.firstName,
        reservation.lastName,
        reservation.email,
        reservation.phone,
        reservation.roomId,
        reservation.notes,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
    })
    .sort((first, second) =>
      `${first.date}T${first.startTime}`.localeCompare(`${second.date}T${second.startTime}`),
    )
}

export function getReservationStats(reservations: Reservation[], today: string) {
  return {
    today: reservations.filter((reservation) => reservation.date === today).length,
    upcoming: reservations.filter(
      (reservation) => reservation.date >= today && reservation.status !== 'cancelled',
    ).length,
    pending: reservations.filter((reservation) => reservation.status === 'pending').length,
    cancelled: reservations.filter((reservation) => reservation.status === 'cancelled').length,
  }
}

export function formatDisplayDate(date: string): string {
  return new Intl.DateTimeFormat('ro-MD', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${date}T12:00:00`))
}

type NormalizedReservationFormData = ReservationFormData & {
  status: ReservationStatus
  notes: string
}

function normalizeFormData(formData: ReservationFormData): NormalizedReservationFormData {
  return {
    roomId: formData.roomId,
    date: formData.date,
    startTime: formData.startTime,
    endTime: formData.endTime ?? getEndTime(formData.startTime),
    firstName: formData.firstName.trim(),
    lastName: formData.lastName.trim(),
    email: formData.email.trim().toLowerCase(),
    phone: formData.phone.trim(),
    status: formData.status ?? 'confirmed',
    notes: formData.notes?.trim() ?? '',
  }
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const minutesPart = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutesPart).padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function startOfWeek(date: string): string {
  const nextDate = createLocalDate(date)
  const day = nextDate.getDay() || 7
  nextDate.setDate(nextDate.getDate() - day + 1)
  return toDateInputValue(nextDate)
}

function addDays(date: string, days: number): string {
  const nextDate = createLocalDate(date)
  nextDate.setDate(nextDate.getDate() + days)
  return toDateInputValue(nextDate)
}

function createLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

function toDateInputValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
