import type { Reservation, ReservationFormData, ReservationStatus, Room, TimeSlot } from '../domain/types'

const API_BASE_URL = normalizeApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api',
)
const JSON_HEADERS = {
  Accept: 'application/json',
}

export type ApiRoom = {
  id: string
  name: string
  capacity: number
  business_id?: string
  location?: string | null
  amenities?: string[]
  accent?: string | null
  is_active?: boolean
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

export async function fetchRooms(): Promise<Room[]> {
  const response = await getJson<{ data: ApiRoom[] }>('/rooms')

  return response.data.map(assertApiRoom).map(mapApiRoom)
}

export async function fetchAdminRooms(): Promise<Room[]> {
  const response = await getJson<{ data: ApiRoom[] }>('/admin/rooms')

  return response.data.map(assertApiRoom).map(mapApiRoom)
}

export async function createAdminRoom(room: Room): Promise<Room> {
  const response = await postJson<{ data: ApiRoom }>('/admin/rooms', roomToApiPayload(room))

  return mapApiRoom(response.data)
}

export async function updateAdminRoom(room: Room): Promise<Room> {
  const response = await putJson<{ data: ApiRoom }>(`/admin/rooms/${room.id}`, roomToApiPayload(room))

  return mapApiRoom(response.data)
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

export async function fetchAdminReservations(): Promise<Reservation[]> {
  const response = await getJson<{ data: ApiReservation[] }>('/admin/reservations')

  return response.data.map(mapApiReservation)
}

export async function deleteAdminReservation(reservationId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}`, {
    method: 'DELETE',
    headers: JSON_HEADERS,
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }
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

export function mapApiRoom(room: ApiRoom): Room {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    businessId: room.business_id,
    location: room.location ?? '',
    amenities: room.amenities ?? [],
    accent: room.accent ?? '#f7de05',
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: JSON_HEADERS,
  })

  return parseJsonResponse<T>(response)
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<T>(response)
}

async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { ...JSON_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return parseJsonResponse<T>(response)
}

function roomToApiPayload(room: Room) {
  return {
    name: room.name,
    capacity: room.capacity,
    business_id: room.businessId,
    location: room.location,
    amenities: room.amenities,
    accent: room.accent,
  }
}

function assertApiRoom(room: ApiRoom): ApiRoom {
  if (
    typeof room.id !== 'string' ||
    typeof room.name !== 'string' ||
    typeof room.capacity !== 'number'
  ) {
    throw new Error('Invalid room API response.')
  }

  return room
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message ?? 'API request failed.')
  }

  return data
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json()

    return data.message ?? 'API request failed.'
  } catch {
    return 'API request failed.'
  }
}

function normalizeApiBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}
