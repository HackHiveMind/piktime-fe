import type { Reservation, ReservationFormData, ReservationStatus, TimeSlot } from '../domain/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

export type ApiRoom = {
  id: string
  name: string
  capacity: number
}

export type AvailabilitySlot = TimeSlot & {
  available: boolean
}

export type RoomAvailability = {
  roomId: string
  date: string
  slots: AvailabilitySlot[]
}

type ApiReservation = {
  id: string
  room_id: string
  date: string
  start_time: string
  end_time: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: ReservationStatus
  notes: string | null
  created_at: string
}

export async function fetchRooms(): Promise<ApiRoom[]> {
  const response = await getJson<{ data: ApiRoom[] }>('/rooms')

  return response.data
}

export async function fetchRoomAvailability(
  roomId: string,
  date: string,
): Promise<RoomAvailability> {
  const response = await getJson<{
    data: {
      room_id: string
      date: string
      slots: AvailabilitySlot[]
    }
  }>(`/rooms/${roomId}/availability?date=${date}`)

  return {
    roomId: response.data.room_id,
    date: response.data.date,
    slots: response.data.slots,
  }
}

export async function createPublicReservation(
  reservation: ReservationFormData,
): Promise<Reservation> {
  const response = await postJson<{ data: ApiReservation }>('/reservations', {
    room_id: reservation.roomId,
    date: reservation.date,
    start_time: reservation.startTime,
    first_name: reservation.firstName,
    last_name: reservation.lastName,
    email: reservation.email,
    phone: reservation.phone,
    notes: reservation.notes,
  })

  return mapApiReservation(response.data)
}

export async function createAdminReservation(
  reservation: ReservationFormData,
): Promise<Reservation> {
  const response = await postJson<{ data: ApiReservation }>('/admin/reservations', {
    room_id: reservation.roomId,
    date: reservation.date,
    start_time: reservation.startTime,
    end_time: reservation.endTime,
    first_name: reservation.firstName,
    last_name: reservation.lastName,
    email: reservation.email,
    phone: reservation.phone,
    status: reservation.status,
    notes: reservation.notes,
  })

  return mapApiReservation(response.data)
}

export function mapApiReservation(reservation: ApiReservation): Reservation {
  return {
    id: String(reservation.id),
    roomId: reservation.room_id,
    date: reservation.date,
    startTime: reservation.start_time,
    endTime: reservation.end_time,
    firstName: reservation.first_name,
    lastName: reservation.last_name,
    email: reservation.email,
    phone: reservation.phone,
    status: reservation.status,
    notes: reservation.notes ?? '',
    createdAt: reservation.created_at,
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  return parseJsonResponse<T>(response)
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<T>(response)
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message ?? 'API request failed.')
  }

  return data
}
