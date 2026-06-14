import { CalendarCheck, CheckCircle2, MapPin, Users } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ReservationForm } from '../components/ReservationForm'
import { SlotPicker } from '../components/SlotPicker'
import { rooms as fallbackRooms } from '../data/rooms'
import {
  findConflictingReservation,
  findConflictingRoomBlock,
  getPublicBookingSlots,
} from '../domain/booking'
import type { Reservation, ReservationFormData, Room, RoomBlock, TimeSlot } from '../domain/types'
import {
  createPublicReservation,
  fetchRoomAvailability,
  fetchRooms,
  type AvailabilitySlot,
} from '../services/bookingApi'
import { getRoomBlocks } from '../services/reservationStore'

const today = new Date().toISOString().slice(0, 10)
const orderedFallbackRooms = orderConferenceRoomsFirst(fallbackRooms)

export function UserBookingPage() {
  const [date, setDate] = useState(today)
  const [rooms, setRooms] = useState<Room[]>(fallbackRooms)
  const [selectedRoomId, setSelectedRoomId] = useState(orderedFallbackRooms[0].id)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [availability, setAvailability] = useState<Record<string, AvailabilitySlot[]>>({})
  const [roomBlocks] = useState<RoomBlock[]>(() => getRoomBlocks())
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<ReservationFormData>(() =>
    emptyFormData(orderedFallbackRooms[0].id, today, ''),
  )

  const orderedRooms = useMemo(() => orderConferenceRoomsFirst(rooms), [rooms])
  const selectedRoom = orderedRooms.find((room) => room.id === selectedRoomId) ?? orderedRooms[0] ?? orderedFallbackRooms[0]

  useEffect(() => {
    let isMounted = true

    fetchRooms()
      .then((apiRooms) => {
        if (!isMounted) {
          return
        }

        setRooms(apiRooms.map(mergeRoomMetadata))
      })
      .catch(() => {
        if (isMounted) {
          setMessage('Nu am putut incarca salile din API. Folosim lista locala temporar.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (orderedRooms.some((room) => room.id === selectedRoomId)) {
      return
    }

    const nextRoomId = orderedRooms[0]?.id ?? orderedFallbackRooms[0].id
    setSelectedRoomId(nextRoomId)
    setFormData((current) => ({ ...current, roomId: nextRoomId }))
  }, [orderedRooms, selectedRoomId])

  useEffect(() => {
    let isMounted = true

    Promise.all(
      rooms.map((room) =>
        fetchRoomAvailability(room.id, date).then((roomAvailability) => [
          room.id,
          roomAvailability.slots,
        ] as const),
      ),
    )
      .then((entries) => {
        if (isMounted) {
          setAvailability(Object.fromEntries(entries))
        }
      })
      .catch(() => {
        if (isMounted) {
          setMessage('Nu am putut incarca disponibilitatea din API.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [date, rooms])

  const availableCounts = useMemo(() => {
    return new Map(
      orderedRooms.map((room) => [
        room.id,
        (availability[room.id] ?? getPublicBookingSlots().map((slot) => ({ ...slot, available: true }))).filter(
          (slot) =>
            slot.available !== false &&
            !findConflictingReservation(reservations, {
              roomId: room.id,
              date,
              startTime: slot.start,
              endTime: slot.end,
            }) &&
            !findConflictingRoomBlock(roomBlocks, {
              roomId: room.id,
              startTime: slot.start,
              endTime: slot.end,
            }),
        ).length,
      ]),
    )
  }, [availability, date, orderedRooms, reservations, roomBlocks])

  const selectedAvailableCount = availableCounts.get(selectedRoom.id) ?? 0

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId)
    setSelectedSlot('')
    setMessage('')
    setFormData((current) => ({ ...current, roomId, date, startTime: '', endTime: undefined }))
  }

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot.start)
    setMessage('')
    setFormData((current) => ({
      ...current,
      roomId: selectedRoom.id,
      date,
      startTime: slot.start,
      endTime: slot.end,
    }))
  }

  const handleDateChange = (nextDate: string) => {
    setDate(nextDate)
    setSelectedSlot('')
    setMessage('')
    setFormData((current) => ({ ...current, date: nextDate, startTime: '', endTime: undefined }))
  }

  const handleSubmit = async () => {
    if (!formData.startTime) {
      setMessage('Alege un slot disponibil inainte de confirmare.')
      return
    }

    const validationMessage = getReservationValidationMessage(formData)
    if (validationMessage) {
      setMessage(validationMessage)
      return
    }

    const conflict = findConflictingReservation(reservations, formData)
    if (conflict) {
      setMessage('Slotul a fost deja rezervat. Alege alta ora.')
      return
    }

    const blockConflict = findConflictingRoomBlock(roomBlocks, {
      roomId: formData.roomId,
      startTime: formData.startTime,
      endTime: formData.endTime ?? formData.startTime,
    })
    if (blockConflict) {
      setMessage('Slotul este blocat de admin. Alege alta ora.')
      return
    }

    setIsSubmitting(true)

    try {
      const reservation = await createPublicReservation(formData)
      setReservations((current) => [reservation, ...current])
      setAvailability((current) => ({
        ...current,
        [reservation.roomId]: (current[reservation.roomId] ?? []).map((slot) =>
          slot.start === reservation.startTime ? { ...slot, available: false } : slot,
        ),
      }))
      setSelectedSlot('')
      setFormData(emptyFormData(selectedRoom.id, date, ''))
      setMessage(`Rezervare confirmata pentru ${selectedRoom.name}, ora ${reservation.startTime}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Rezervarea nu a putut fi salvata.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-band">
        <div>
          <span className="eyebrow">Booking sali conferinta</span>
          <h1>Rezerva o sala</h1>
          <p>
            Alege data, sala si un slot de o ora intre 09:00 si 21:00. Nu ai nevoie
            de cont pentru prima versiune iHUB.
          </p>
        </div>
        <label className="date-control">
          Data rezervarii
          <input type="date" value={date} onChange={(event) => handleDateChange(event.target.value)} />
        </label>
      </section>

      <section className="content-grid">
        <div className="room-select-panel">
          <label className="room-select-control">
            Alege sala
            <select value={selectedRoomId} onChange={(event) => handleRoomSelect(event.target.value)}>
              {orderedRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <div className="selected-room-summary" style={{ '--room-accent': selectedRoom.accent } as CSSProperties}>
            <span className="room-card-accent" />
            <span className="room-card-title">{selectedRoom.name}</span>
            <span className="room-card-meta">
              <span>
                <Users size={16} />
                {selectedRoom.capacity} persoane
              </span>
              <span>
                <MapPin size={16} />
                {selectedRoom.location}
              </span>
            </span>
            <span className="amenity-row">
              {selectedRoom.amenities.map((amenity) => (
                <span key={amenity}>{amenity}</span>
              ))}
            </span>
            <span className="availability-pill">{selectedAvailableCount} sloturi libere</span>
          </div>
        </div>

        <div className="booking-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">{selectedRoom.location}</span>
              <h2>{selectedRoom.name}</h2>
            </div>
            <CalendarCheck size={28} />
          </div>

          <SlotPicker
            roomId={selectedRoom.id}
            date={date}
            reservations={reservations}
            roomBlocks={roomBlocks}
            slots={availability[selectedRoom.id]}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
          />

          <ReservationForm
            value={formData}
            submitLabel={isSubmitting ? 'Se salveaza...' : 'Confirma rezervarea'}
            onChange={setFormData}
            onSubmit={handleSubmit}
          />

          {message ? (
            <p className="status-message">
              <CheckCircle2 size={18} />
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function getReservationValidationMessage(formData: ReservationFormData): string {
  if (!formData.lastName.trim()) {
    return 'Completeaza numele.'
  }

  if (!formData.firstName.trim()) {
    return 'Completeaza prenumele.'
  }

  if (!formData.email.trim()) {
    return 'Completeaza emailul.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
    return 'Introdu un email valid.'
  }

  if (!formData.phone.trim()) {
    return 'Completeaza numarul de telefon.'
  }

  return ''
}

function mergeRoomMetadata(room: Room): Room {
  const localRoom = fallbackRooms.find((item) => item.id === room.id)

  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    businessId: room.businessId ?? localRoom?.businessId,
    location: room.location || localRoom?.location || 'iHUB',
    amenities: room.amenities.length > 0 ? room.amenities : localRoom?.amenities ?? [],
    accent: room.accent || localRoom?.accent || '#74bd45',
  }
}

function orderConferenceRoomsFirst(roomList: Room[]): Room[] {
  return [...roomList].sort((firstRoom, secondRoom) => {
    const firstScore = isConferenceRoom(firstRoom) ? 0 : 1
    const secondScore = isConferenceRoom(secondRoom) ? 0 : 1

    if (firstScore !== secondScore) {
      return firstScore - secondScore
    }

    return firstRoom.name.localeCompare(secondRoom.name)
  })
}

function isConferenceRoom(room: Room): boolean {
  const searchableText = `${room.name} ${room.location}`.toLowerCase()

  return searchableText.includes('conference') || searchableText.includes('conferinta')
}

function emptyFormData(roomId: string, date: string, startTime: string): ReservationFormData {
  return {
    roomId,
    date,
    startTime,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  }
}
