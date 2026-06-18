export type Room = {
  id: string
  name: string
  capacity: number
  location: string
  amenities: string[]
  accent: string
  imageUrl?: string
  businessId?: string
}

export type TimeSlot = {
  start: string
  end: string
  label: string
}

export type ReservationStatus = 'confirmed' | 'pending' | 'cancelled' | 'no-show'

export type CalendarView = 'day' | 'week' | 'month' | 'agenda'

export type ReservationFormData = {
  roomId: string
  date: string
  startTime: string
  endTime?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  status?: ReservationStatus
  notes?: string
}

export type Reservation = ReservationFormData & {
  id: string
  endTime: string
  createdAt: string
  status: ReservationStatus
  notes: string
}

export type RoomBlockFormData = {
  roomId: string
  startTime: string
  endTime: string
  notes?: string
}

export type RoomBlock = RoomBlockFormData & {
  id: string
  createdAt: string
  notes: string
}
