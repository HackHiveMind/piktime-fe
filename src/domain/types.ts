export type Room = {
  id: string
  name: string
  capacity: number
  location: string
  amenities: string[]
  accent: string
}

export type TimeSlot = {
  start: string
  end: string
  label: string
}

export type ReservationFormData = {
  roomId: string
  date: string
  startTime: string
  firstName: string
  lastName: string
  email: string
  phone: string
}

export type Reservation = ReservationFormData & {
  id: string
  endTime: string
  createdAt: string
}

